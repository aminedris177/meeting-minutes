// «إضافة للتقويم»: ملف .ics لاجتماعات السلسلة (حدث متكرر) أو لمواعيد مهامها المفتوحة.
import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { useLive } from '../../db/live';
import { seriesNextDate } from '../../db/repos/meetings';
import { displayName } from '../../db/repos/people';
import { db } from '../../db/schema';
import type { Series } from '../../db/types';
import { isOpen } from '../../domain/delay';
import { DEFAULT_CAL_OPTIONS, seriesMeetingsIcs, taskDeadlinesIcs, type MeetingCalendarOptions, type ReminderKey } from '../../export/ics';
import { safeFileName, shareOrDownload } from '../../export/share';
import { fmt, t } from '../../i18n';
import { formatDate } from '../../lib/dates';
import { isIOS } from '../../lib/platform';
import { saveExportedFile } from '../../db/files';

const REMINDERS: ReminderKey[] = ['none', '15m', '1h', '1d', '1d1h'];

/**
 * فتح ملف التقويم: على الآيفون بنفتحه مباشرة (Safari بيعرض «إضافة الكل» للتقويم)،
 * وعلى الأندرويد بيتنزّل وبيتفتح في تطبيق التقويم.
 */
function openIcs(text: string, fileName: string, seriesName: string): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  // نسخة في «الملفات المصدّرة» (من غير انتظار — الفتح لازم يحصل فوراً)
  void saveExportedFile(blob, fileName, { kind: 'calendar', seriesName }).catch(() => alert(t().files.saveFailed));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  if (!isIOS()) a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function shareIcs(text: string, fileName: string, seriesName: string): Promise<void> {
  try {
    await shareOrDownload(new Blob([text], { type: 'text/calendar' }), fileName, fileName, { kind: 'calendar', seriesName });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') throw e;
  }
}

export function CalendarSheet({ series, onClose }: { series: Series; onClose: () => void }) {
  const m = t().addToCal;
  const [opt, setOpt] = useState<MeetingCalendarOptions>(series.calendar ?? DEFAULT_CAL_OPTIONS);
  const next = useLive(() => seriesNextDate(series), [series.id, series.updatedAt]);
  const tasks = useLive(
    async () => (await db.tasks.where('seriesId').equals(series.id).toArray()).filter((x) => isOpen(x) && x.targetDate),
    [series.id],
  );
  const people = useLive(() => db.people.toArray(), []);
  const set = <K extends keyof MeetingCalendarOptions>(k: K, v: MeetingCalendarOptions[K]) => setOpt((o) => ({ ...o, [k]: v }));

  const meetingsFile = () => {
    if (!next) return null;
    const topics = series.defaultTopics.filter(Boolean).join(' · ');
    return {
      text: seriesMeetingsIcs(
        { seriesId: series.id, seriesName: series.name, start: next, recurrence: series.recurrence, description: topics, sequence: Math.floor(series.updatedAt / 1000) },
        opt,
      ),
      name: `${safeFileName(`${m.filePrefix}_${series.name}`)}.ics`,
    };
  };

  const tasksFile = () => {
    if (!tasks?.length) return null;
    const pMap = new Map((people ?? []).map((p) => [p.id, p]));
    return {
      text: taskDeadlinesIcs(
        `${series.name} — ${t().report.title}`,
        tasks.map((x) => ({
          id: x.id,
          code: x.code,
          description: x.description,
          owner: x.ownerId && pMap.get(x.ownerId) ? displayName(pMap.get(x.ownerId)!) : t().task.unassigned,
          target: x.targetDate!,
          sequence: Math.floor(x.updatedAt / 1000),
        })),
      ),
      name: `${safeFileName(`${m.tasksFile}_${series.name}`)}.ics`,
    };
  };

  // الإعدادات بتتحفظ على السلسلة علشان المرة الجاية (من غير ما تغيّر updatedAt — مش تعديل في الاجتماعات)
  const remember = () => void db.series.update(series.id, { calendar: opt });

  const run = (kind: 'meetings' | 'tasks', mode: 'open' | 'share') => {
    const f = kind === 'meetings' ? meetingsFile() : tasksFile();
    if (!f) return;
    if (kind === 'meetings') remember();
    if (mode === 'open') openIcs(f.text, f.name, series.name);
    else void shareIcs(f.text, f.name, series.name).catch((e) => alert(fmt(t().common.error, { msg: String(e) })));
  };

  return (
    <Sheet title={m.title} onClose={onClose}>
      <p class="muted small">{m.hint}</p>

      <div class="field-pair">
        <div class="field">
          <label for="cal-time">{m.time}</label>
          <input id="cal-time" type="time" value={opt.time} dir="ltr" onInput={(e) => e.currentTarget.value && set('time', e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="cal-dur">{m.duration}</label>
          <input
            id="cal-dur"
            type="number"
            inputMode="numeric"
            min={15}
            max={600}
            step={15}
            dir="ltr"
            value={opt.durationMin}
            onInput={(e) => {
              const n = parseInt(e.currentTarget.value, 10);
              if (n > 0) set('durationMin', Math.min(600, n));
            }}
          />
        </div>
      </div>
      <div class="field">
        <span class="label">{m.reminder}</span>
        <select value={opt.reminder} onChange={(e) => set('reminder', e.currentTarget.value as ReminderKey)} aria-label={m.reminder}>
          {REMINDERS.map((r) => (
            <option value={r}>{m.reminders[r]}</option>
          ))}
        </select>
      </div>

      <div class="cal-actions">
        {next ? (
          <>
            <button class="btn primary full-width" onClick={() => run('meetings', 'open')}>
              {m.meetings}
            </button>
            <p class="muted small center" dir="auto">
              {t().meetings.next}: <span dir="ltr">{formatDate(next)}</span> · {t().series.kinds[series.recurrence.kind]}
            </p>
          </>
        ) : (
          <p class="warn small">{m.noNext}</p>
        )}
        {tasks && tasks.length > 0 ? (
          <button class="btn full-width" onClick={() => run('tasks', 'open')}>
            {fmt(m.tasks, { n: tasks.length })}
          </button>
        ) : (
          <p class="muted small">{m.noTasks}</p>
        )}
        {(next || (tasks && tasks.length > 0)) && (
          <div class="btn-row tight">
            {next && (
              <button class="btn ghost sm grow" onClick={() => run('meetings', 'share')}>
                {m.share}
              </button>
            )}
          </div>
        )}
      </div>
      <p class="help-tip">{m.outlookHint}</p>
      <p class="help-tip">{m.updateHint}</p>
    </Sheet>
  );
}
