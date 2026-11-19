import { describe, expect, it } from 'vitest';
import {
  addDecision,
  addGuest,
  addRegisterItem,
  buildMinutes,
  createMeeting,
  deleteDraftMeeting,
  finalizeMeeting,
  getDraft,
  listAttendance,
  reopenMeeting,
  reviewItems,
  saveMeetingUpdate,
  seriesNextDate,
  setNextDate,
  setPresent,
  updateDecision,
  updateMeeting,
} from '../src/db/repos/meetings';
import { addPerson } from '../src/db/repos/people';
import { createSeries } from '../src/db/repos/series';
import { createTask, listTaskUpdates, setTaskStatus } from '../src/db/repos/tasks';
import { emptySeriesDraft } from '../src/domain/series';
import type { AppDB } from '../src/db/schema';
import { freshDb } from './helpers';

async function setup(d: AppDB, over = {}) {
  const a = await addPerson({ name: 'شخص أ', title: 'م/', position: 'قسم ١', email: '' }, d);
  const b = await addPerson({ name: 'شخص ب', title: '', position: '', email: '' }, d);
  const s = await createSeries(
    {
      ...emptySeriesDraft(),
      name: 'سلسلة',
      taskPrefix: 'Y',
      memberIds: [a.id, b.id],
      defaultTopics: ['محور ١', 'محور ٢'],
      firstMeetingDate: '2026-11-16',
      ...over,
    },
    d,
  );
  return { a, b, s };
}

describe('createMeeting', () => {
  it('numbers meetings, uses the expected date, computes next date, copies topics and members', async () => {
    const d = freshDb();
    const { a, b, s } = await setup(d);
    const m1 = await createMeeting(s.id, '2026-11-20', d);
    expect(m1).toMatchObject({ number: 1, date: '2026-11-16', nextDate: '2026-11-23', topics: ['محور ١', 'محور ٢'], status: 'draft' });
    const att = await listAttendance(m1.id, d);
    expect(att.map((x) => [x.personId, x.present])).toEqual([
      [a.id, true],
      [b.id, true],
    ]);
    expect(await getDraft(s.id, d)).toMatchObject({ id: m1.id });

    await finalizeMeeting(m1.id, d);
    expect(await seriesNextDate((await d.series.get(s.id))!, d)).toBe('2026-11-23');
    const m2 = await createMeeting(s.id, '2026-11-20', d);
    expect(m2).toMatchObject({ number: 2, date: '2026-11-23', nextDate: '2026-11-30' });
  });

  it('falls back to today without a first meeting date', async () => {
    const d = freshDb();
    const { s } = await setup(d, { firstMeetingDate: undefined, recurrence: { kind: 'monthly' } });
    expect(await createMeeting(s.id, '2026-01-31', d)).toMatchObject({ date: '2026-01-31', nextDate: '2026-02-28' });
  });
});

describe('next meeting date', () => {
  it('recomputes on date change unless set manually', async () => {
    const d = freshDb();
    const { s } = await setup(d);
    const m = await createMeeting(s.id, '2026-11-20', d);
    await updateMeeting(m.id, { date: '2026-11-17' }, d);
    expect((await d.meetings.get(m.id))!.nextDate).toBe('2026-11-24');

    await setNextDate(m.id, '2026-12-01', d);
    await updateMeeting(m.id, { date: '2026-11-18' }, d);
    expect(await d.meetings.get(m.id)).toMatchObject({ nextDate: '2026-12-01', nextDateManual: true });

    await setNextDate(m.id, undefined, d);
    expect(await d.meetings.get(m.id)).toMatchObject({ nextDate: '2026-11-25', nextDateManual: false });
  });
});

describe('attendance', () => {
  it('toggles presence and adds one-off guests', async () => {
    const d = freshDb();
    const { b, s } = await setup(d);
    const m = await createMeeting(s.id, '2026-11-20', d);
    const rowB = (await listAttendance(m.id, d)).find((x) => x.personId === b.id)!;
    await setPresent(rowB.id, false, d);
    await addGuest(m.id, ' ضيف ', 'د/', d);
    const att = await listAttendance(m.id, d);
    expect(att.map((x) => [x.guestName ?? 'member', x.present])).toEqual([
      ['member', true],
      ['member', false],
      ['ضيف', true],
    ]);
    // الضيف مش بيدخل الحضور الثابت
    expect((await d.series.get(s.id))!.memberIds).toHaveLength(2);
    await expect(addGuest(m.id, ' ', '', d)).rejects.toThrow();
  });
});

describe('review', () => {
  it('lists open tasks overdue first, keeps tasks closed during the meeting, excludes new ones', async () => {
    const d = freshDb();
    const { s } = await setup(d);
    const base = { seriesId: s.id, topic: '', ownerId: null, createdDate: '2026-11-01', priority: 'medium' as const };
    const late = await createTask({ ...base, description: 'متأخرة', targetDate: '2026-11-10' }, d);
    const ok = await createTask({ ...base, description: 'في الميعاد', targetDate: '2026-12-10' }, d);
    const closedBefore = await createTask({ ...base, description: 'مقفولة قبل' }, d);
    await setTaskStatus(closedBefore.id, 'done', '2026-11-05', {}, d);

    const m = await createMeeting(s.id, '2026-11-20', d);
    await createTask({ ...base, description: 'جديدة', meetingId: m.id }, d);
    await setTaskStatus(ok.id, 'done', m.date, { meetingId: m.id }, d);

    const items = await reviewItems((await d.meetings.get(m.id))!, d);
    expect(items.map((r) => r.task.description)).toEqual(['متأخرة', 'في الميعاد']);
    expect(items[0].delay).toBe(6); // محسوبة بتاريخ الاجتماع 16/11
    expect(items.map((r) => r.task.id)).not.toContain(closedBefore.id);
    expect(items[1].task.id).toBe(ok.id);
    expect(late.id).toBe(items[0].task.id);
  });

  it('keeps one editable update per task per meeting, and never touches older meetings', async () => {
    const d = freshDb();
    const { s } = await setup(d);
    const t = await createTask({ seriesId: s.id, description: 'مهمة', topic: '', ownerId: null, createdDate: '2026-11-01', priority: 'low' }, d);
    const m1 = await createMeeting(s.id, '2026-11-20', d);
    await saveMeetingUpdate(m1, t.id, 'أول', 'مطلوب', d);
    await saveMeetingUpdate(m1, t.id, 'أول (معدّل)', 'مطلوب', d);
    await finalizeMeeting(m1.id, d);

    const m2 = await createMeeting(s.id, '2026-11-20', d);
    await saveMeetingUpdate(m2, t.id, 'تاني', '', d);
    const log = await listTaskUpdates(t.id, d);
    expect(log.map((u) => [u.text, u.meetingId === m1.id ? 1 : 2])).toEqual([
      ['تاني', 2],
      ['أول (معدّل)', 1],
    ]);
    await saveMeetingUpdate(m2, t.id, '', '', d);
    expect(await listTaskUpdates(t.id, d)).toHaveLength(1);
  });
});

describe('minutes model, finalize and snapshot', () => {
  it('builds the minutes and freezes them when final', async () => {
    const d = freshDb();
    const { s } = await setup(d, { sections: { decisions: true, newTasks: true, register: true, signatures: true }, registerName: 'السجل' });
    await d.org.put({ id: 'org', name: 'جهة', updatedAt: 0 });
    const base = { seriesId: s.id, topic: 'محور ١', ownerId: null, createdDate: '2026-11-01', priority: 'medium' as const };
    const t = await createTask({ ...base, description: 'قديمة', targetDate: '2026-11-10' }, d);
    const m = await createMeeting(s.id, '2026-11-20', d);
    await saveMeetingUpdate(m, t.id, 'تم جزء', 'الباقي', d);
    const nt = await createTask({ ...base, description: 'جديدة', meetingId: m.id }, d);
    const dec = await addDecision(m.id, 'قرار ١', d);
    await updateDecision(dec.id, { taskId: nt.id }, d);
    await addDecision(m.id, '   ', d); // فاضي — مش بيظهر
    await addGuest(m.id, 'ضيف', '', d);
    await addRegisterItem(s.id, m.id, { item: 'بند ١', text: 'نص', status: 'approved' }, d);

    const model = await buildMinutes(m.id, d);
    expect(model).toMatchObject({
      orgName: 'جهة',
      seriesName: 'سلسلة',
      number: 1,
      date: '2026-11-16',
      nextDate: '2026-11-23',
      registerName: 'السجل',
      status: 'draft',
    });
    expect(model.attendees.map((a) => [a.name, a.present, a.guest])).toEqual([
      ['م/ شخص أ', true, false],
      ['شخص ب', true, false],
      ['ضيف', true, true],
    ]);
    expect(model.review).toEqual([
      expect.objectContaining({ code: 'Y-01', update: 'تم جزء', nextAction: 'الباقي', status: 'not_started', delay: 6 }),
    ]);
    expect(model.newTasks.map((x) => x.code)).toEqual(['Y-02']);
    expect(model.decisions).toEqual([{ text: 'قرار ١', taskCode: 'Y-02' }]);
    expect(model.register).toEqual([{ item: 'بند ١', text: 'نص', status: 'approved', isNew: true }]);

    await finalizeMeeting(m.id, d);
    // بعد الإنهاء: تغيير الحالة مبيأثرش على المحضر المحفوظ
    await setTaskStatus(t.id, 'done', '2026-11-25', {}, d);
    const frozen = await buildMinutes(m.id, d);
    expect(frozen.status).toBe('final');
    expect(frozen.review[0].status).toBe('not_started');

    await reopenMeeting(m.id, d);
    expect((await d.meetings.get(m.id))!.snapshot).toBeUndefined();
  });
});

describe('deleteDraftMeeting', () => {
  it('deletes a draft, keeps status history unlinked, and rolls back the counter', async () => {
    const d = freshDb();
    const { s } = await setup(d);
    const t = await createTask({ seriesId: s.id, description: 'مهمة', topic: '', ownerId: null, createdDate: '2026-11-01', priority: 'low' }, d);
    const m = await createMeeting(s.id, '2026-11-20', d);
    await saveMeetingUpdate(m, t.id, 'نص', '', d);
    await setTaskStatus(t.id, 'in_progress', m.date, { meetingId: m.id }, d);
    await deleteDraftMeeting(m.id, d);
    expect(await d.meetings.get(m.id)).toBeUndefined();
    expect(await d.attendance.where('meetingId').equals(m.id).count()).toBe(0);
    const log = await listTaskUpdates(t.id, d);
    expect(log.map((u) => [u.status, u.meetingId])).toEqual([['in_progress', undefined]]);
    expect((await d.series.get(s.id))!.meetingCounter).toBe(0);
    expect((await createMeeting(s.id, '2026-11-20', d)).number).toBe(1);
  });

  it('refuses drafts with new tasks and final meetings', async () => {
    const d = freshDb();
    const { s } = await setup(d);
    const m = await createMeeting(s.id, '2026-11-20', d);
    await createTask({ seriesId: s.id, description: 'جديدة', topic: '', ownerId: null, createdDate: '2026-11-01', priority: 'low', meetingId: m.id }, d);
    await expect(deleteDraftMeeting(m.id, d)).rejects.toThrow();
    const m2 = await createMeeting(s.id, '2026-11-20', d);
    await finalizeMeeting(m2.id, d);
    await expect(deleteDraftMeeting(m2.id, d)).rejects.toThrow();
  });
});
