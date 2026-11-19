import { describe, expect, it } from 'vitest';
import { foldLine, icsEscape, rrule, seriesMeetingsIcs, taskDeadlinesIcs } from '../src/export/ics';

const now = new Date(Date.UTC(2026, 10, 19, 8, 30, 0));
const unfold = (s: string) => s.replace(/\r\n /g, '');

describe('ics helpers', () => {
  it('escapes special characters', () => {
    expect(icsEscape('a,b;c\\d\nسطر')).toBe('a\\,b\\;c\\\\d\\nسطر');
  });

  it('folds long lines at 75 bytes without splitting Arabic letters', () => {
    const line = `SUMMARY:${'محضر اجتماع الجودة الأسبوعي '.repeat(6)}`;
    const folded = foldLine(line);
    const enc = new TextEncoder();
    for (const part of folded.split('\r\n')) expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    expect(unfold(folded)).toBe(line);
  });

  it('maps recurrence to RRULE', () => {
    expect(rrule({ kind: 'weekly' })).toBe('FREQ=WEEKLY;INTERVAL=1');
    expect(rrule({ kind: 'biweekly' })).toBe('FREQ=WEEKLY;INTERVAL=2');
    expect(rrule({ kind: 'monthly' })).toBe('FREQ=MONTHLY;INTERVAL=1');
    expect(rrule({ kind: 'custom', everyDays: 10 })).toBe('FREQ=DAILY;INTERVAL=10');
  });
});

describe('series meetings calendar', () => {
  it('builds one recurring event with local time and reminders', () => {
    const ics = seriesMeetingsIcs(
      { seriesId: 'abc', seriesName: 'اجتماع الجودة, الأسبوعي', start: '2026-11-23', recurrence: { kind: 'weekly' }, description: 'محاور', sequence: 3 },
      { time: '09:30', durationMin: 90, reminder: '1d1h' },
      now,
    );
    const u = unfold(ics);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(u).toContain('UID:series-abc@meeting-minutes');
    expect(u).toContain('DTSTART:20261123T093000');
    expect(u).toContain('DTEND:20261123T110000');
    expect(u).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1');
    expect(u).toContain('SUMMARY:اجتماع الجودة\\, الأسبوعي');
    expect(u).toContain('SEQUENCE:3');
    expect(u).toContain('DTSTAMP:20261119T083000Z');
    expect(u.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(u).toContain('TRIGGER:-P1D');
    expect(u).toContain('TRIGGER:-PT1H');
    expect(u).not.toContain('Z\r\nDTEND'); // وقت محلي، مش UTC
  });

  it('crosses midnight correctly and supports no reminder', () => {
    const u = unfold(
      seriesMeetingsIcs({ seriesId: 'x', seriesName: 'S', start: '2026-12-31', recurrence: { kind: 'monthly' }, description: '', sequence: 0 }, { time: '23:30', durationMin: 60, reminder: 'none' }, now),
    );
    expect(u).toContain('DTEND:20270101T003000');
    expect(u).not.toContain('VALARM');
  });
});

describe('task deadlines calendar', () => {
  it('builds all-day events with a 9am reminder', () => {
    const u = unfold(
      taskDeadlinesIcs('مهام', [
        { id: 't1', code: 'Q-01', description: 'مراجعة', owner: 'م/ شخص', target: '2026-11-30', sequence: 1 },
        { id: 't2', code: 'Q-02', description: 'تحديث', owner: '', target: '2026-12-31', sequence: 1 },
      ], now),
    );
    expect(u.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(u).toContain('DTSTART;VALUE=DATE:20261130');
    expect(u).toContain('DTEND;VALUE=DATE:20261201');
    expect(u).toContain('DTEND;VALUE=DATE:20270101');
    expect(u).toContain('SUMMARY:Q-01 · مراجعة');
    expect(u).toContain('TRIGGER;RELATED=START:PT9H');
    expect(u).toContain('UID:task-t2@meeting-minutes');
  });
});

import { monthEnd, monthGrid, projectedMeetings, shiftMonth } from '../src/domain/calendar';

describe('month calendar', () => {
  it('builds a Saturday-first grid covering the whole month', () => {
    const g = monthGrid({ year: 2026, month: 11 });
    // 1/11/2026 = الأحد → أول خانة السبت 31/10
    expect(g[0]).toBe('2026-10-31');
    expect(g.length % 7).toBe(0);
    expect(g).toContain('2026-11-30');
    expect(g[g.length - 1] >= '2026-11-30').toBe(true);
    expect(new Date(2026, 9, 31).getDay()).toBe(6);
  });

  it('shifts months across years and knows month ends', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthEnd({ year: 2028, month: 2 })).toBe('2028-02-29');
  });

  it('projects upcoming meetings from the recurrence, skipping recorded ones', () => {
    const got = projectedMeetings('2026-11-23', { kind: 'weekly' }, '2026-11-01', '2026-12-31', new Set(['2026-12-07']));
    expect(got).toEqual(['2026-11-23', '2026-11-30', '2026-12-14', '2026-12-21', '2026-12-28']);
    expect(projectedMeetings(undefined, { kind: 'weekly' }, '2026-11-01', '2026-11-30', new Set())).toEqual([]);
    // الاجتماع القادم بعد آخر الشهر → مفيش حاجة في الشهر ده
    expect(projectedMeetings('2027-01-05', { kind: 'monthly' }, '2026-11-01', '2026-11-30', new Set())).toEqual([]);
  });
});
