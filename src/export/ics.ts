// ملفات التقويم (.ics — RFC 5545): الاجتماعات المتكررة لسلسلة، ومواعيد المهام.
// التقويم (آيفون/جوجل/Outlook) هو اللي بيبعت التذكير في معاده — من غير سيرفر وحتى والتطبيق مقفول.
// الوقت «محلي عائم» (من غير منطقة زمنية) — بيتفهم بتوقيت الموبايل نفسه.
import type { Recurrence } from '../db/types';
import { addDays, parseISODate, type ISODate } from '../lib/dates';

export type ReminderKey = 'none' | '15m' | '1h' | '1d' | '1d1h';

export interface MeetingCalendarOptions {
  /** "HH:MM" */
  time: string;
  durationMin: number;
  reminder: ReminderKey;
}

export const DEFAULT_CAL_OPTIONS: MeetingCalendarOptions = { time: '10:00', durationMin: 60, reminder: '1d1h' };

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const CRLF = '\r\n';

/** هروب النصوص حسب RFC 5545: \ ; , وسطر جديد */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** طي السطور على 75 بايت (UTF-8) من غير ما نقطع حرف عربي في النص. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = '';
      curBytes = 0;
      limit = 74; // السطر المكمّل بيبدأ بمسافة
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join(`${CRLF} `);
}

function dateTime(date: ISODate, time: string): string {
  const [y, m, d] = date.split('-');
  const [hh, mm] = time.split(':');
  return `${y}${m}${d}T${pad(Number(hh))}${pad(Number(mm))}00`;
}

function addMinutes(date: ISODate, time: string, minutes: number): string {
  const d = parseISODate(date);
  const [hh, mm] = time.split(':').map(Number);
  d.setHours(hh, mm + minutes, 0, 0);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

const dateOnly = (date: ISODate) => date.replace(/-/g, '');

function stampUtc(now: Date): string {
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

export function rrule(r: Recurrence): string {
  switch (r.kind) {
    case 'weekly':
      return 'FREQ=WEEKLY;INTERVAL=1';
    case 'biweekly':
      return 'FREQ=WEEKLY;INTERVAL=2';
    case 'monthly':
      return 'FREQ=MONTHLY;INTERVAL=1';
    case 'custom':
      return `FREQ=DAILY;INTERVAL=${r.everyDays ?? 1}`;
  }
}

function alarms(reminder: ReminderKey, text: string): string[] {
  const triggers: Record<ReminderKey, string[]> = {
    none: [],
    '15m': ['-PT15M'],
    '1h': ['-PT1H'],
    '1d': ['-P1D'],
    '1d1h': ['-P1D', '-PT1H'],
  };
  return triggers[reminder].flatMap((tr) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(text)}`, `TRIGGER:${tr}`, 'END:VALARM']);
}

function wrap(lines: string[], calName: string): string {
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//meeting-minutes//PWA//AR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${icsEscape(calName)}`,
      ...lines,
      'END:VCALENDAR',
    ]
      .map(foldLine)
      .join(CRLF) + CRLF
  );
}

export interface SeriesEventInput {
  seriesId: string;
  seriesName: string;
  /** أول اجتماع في الحدث المتكرر (الاجتماع القادم) */
  start: ISODate;
  recurrence: Recurrence;
  description: string;
  /** بيزيد مع كل تعديل — علشان Outlook يحدّث الحدث بدل ما يكرره */
  sequence: number;
}

/** حدث متكرر واحد لاجتماعات السلسلة. */
export function seriesMeetingsIcs(e: SeriesEventInput, opt: MeetingCalendarOptions, now = new Date()): string {
  return wrap(
    [
      'BEGIN:VEVENT',
      `UID:series-${e.seriesId}@meeting-minutes`,
      `DTSTAMP:${stampUtc(now)}`,
      `SEQUENCE:${e.sequence}`,
      `DTSTART:${dateTime(e.start, opt.time)}`,
      `DTEND:${addMinutes(e.start, opt.time, opt.durationMin)}`,
      `RRULE:${rrule(e.recurrence)}`,
      `SUMMARY:${icsEscape(e.seriesName)}`,
      `DESCRIPTION:${icsEscape(e.description)}`,
      ...alarms(opt.reminder, e.seriesName),
      'END:VEVENT',
    ],
    e.seriesName,
  );
}

export interface TaskEventInput {
  id: string;
  code: string;
  description: string;
  owner: string;
  target: ISODate;
  sequence: number;
}

/**
 * مواعيد المهام: حدث يوم كامل لكل مهمة في يوم الاستحقاق،
 * بتذكير الساعة 9 الصبح في نفس اليوم (TRIGGER بعد بداية اليوم بـ 9 ساعات).
 */
export function taskDeadlinesIcs(calName: string, tasks: TaskEventInput[], now = new Date()): string {
  const lines = tasks.flatMap((t) => [
    'BEGIN:VEVENT',
    `UID:task-${t.id}@meeting-minutes`,
    `DTSTAMP:${stampUtc(now)}`,
    `SEQUENCE:${t.sequence}`,
    `DTSTART;VALUE=DATE:${dateOnly(t.target)}`,
    `DTEND;VALUE=DATE:${dateOnly(addDays(t.target, 1))}`,
    `SUMMARY:${icsEscape(`${t.code} · ${t.description}`)}`,
    `DESCRIPTION:${icsEscape(t.owner)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(`${t.code} · ${t.description}`)}`,
    'TRIGGER;RELATED=START:PT9H',
    'END:VALARM',
    'END:VEVENT',
  ]);
  return wrap(lines, calName);
}
