// النسخ الاحتياطي والاسترجاع: ملف JSON واحد فيه كل حاجة (واللوجو base64) ورقم نسخة الـ schema.
// + تصدير/استيراد إعدادات سلسلة واحدة لجهاز تاني.
import Dexie from 'dexie';
import { nameKey } from '../domain/names';
import { AppDB, db, LATEST_VERSION, newId } from './schema';
import { SETTING } from './repos/settings';
import type { Person, Series } from './types';

export const BACKUP_FORMAT = 'meeting-minutes-backup';
export const SERIES_FORMAT = 'meeting-minutes-series';

export const TABLES = ['org', 'people', 'series', 'meetings', 'attendance', 'tasks', 'taskUpdates', 'decisions', 'registerItems', 'settings'] as const;
export type TableName = (typeof TABLES)[number];

/** إعدادات خاصة بالجهاز — مبتدخلش في النسخة ومبتتمسحش بالاسترجاع */
const DEVICE_SETTINGS: string[] = [SETTING.pin, SETTING.lastBackupAt];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

// ===== Blob ↔ JSON =====

interface EncodedBlob {
  __blob: string; // base64
  type: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function encode(value: unknown): Promise<unknown> {
  if (value instanceof Blob) return { __blob: bytesToBase64(new Uint8Array(await value.arrayBuffer())), type: value.type } satisfies EncodedBlob;
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = await encode(v);
    return out;
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.__blob === 'string') return new Blob([base64ToBytes(v.__blob) as BlobPart], { type: String(v.type ?? '') });
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = decode(x);
    return out;
  }
  return value;
}

// ===== تصدير =====

export async function exportBackup(appVersion: string, d: AppDB = db): Promise<BackupFile> {
  // القراءة كلها جوه transaction واحدة (لقطة متسقة)، والتحويل (Blob → base64) بعدها:
  // أي await لحاجة برّه IndexedDB جوه الـ transaction بيقفلها في المتصفح الحقيقي.
  const raw = {} as Record<TableName, unknown[]>;
  await d.transaction('r', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) {
      let rows = await d.table(t).toArray();
      if (t === 'settings') rows = rows.filter((r: { key: string }) => !DEVICE_SETTINGS.includes(r.key));
      raw[t] = rows;
    }
  });
  const tables = {} as Record<TableName, unknown[]>;
  for (const t of TABLES) tables[t] = (await encode(raw[t])) as unknown[];
  return { format: BACKUP_FORMAT, schemaVersion: d.verno || LATEST_VERSION, appVersion, exportedAt: new Date().toISOString(), tables };
}

export function backupFileName(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `نسخة_احتياطية_محاضر_${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

// ===== التحقق =====

export type BackupError = 'not-json' | 'wrong-format' | 'newer-version' | 'corrupt';

export function parseBackup(text: string): { ok: true; backup: BackupFile } | { ok: false; error: BackupError } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  const b = json as Partial<BackupFile>;
  if (!b || b.format !== BACKUP_FORMAT) return { ok: false, error: 'wrong-format' };
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion < 1) return { ok: false, error: 'corrupt' };
  if (b.schemaVersion > LATEST_VERSION) return { ok: false, error: 'newer-version' };
  if (!b.tables || typeof b.tables !== 'object') return { ok: false, error: 'corrupt' };
  for (const t of TABLES) {
    const rows = (b.tables as Record<string, unknown>)[t];
    if (rows !== undefined && !Array.isArray(rows)) return { ok: false, error: 'corrupt' };
  }
  return { ok: true, backup: b as BackupFile };
}

export function backupSummary(b: BackupFile): Record<'series' | 'people' | 'meetings' | 'tasks', number> {
  const n = (t: TableName) => (b.tables[t] ?? []).length;
  return { series: n('series'), people: n('people'), meetings: n('meetings'), tasks: n('tasks') };
}

// ===== استرجاع =====

/**
 * لو النسخة من schema أقدم: بنحطها في قاعدة مؤقتة بنفس النسخة القديمة، ونفتحها على الأحدث
 * علشان نفس الـ migrations بتاعة التطبيق تشتغل عليها، وبعدين ناخد الصفوف المترقية.
 */
async function upgradeTables(b: BackupFile): Promise<Record<TableName, unknown[]>> {
  const decoded = {} as Record<TableName, unknown[]>;
  for (const t of TABLES) decoded[t] = (decode(b.tables[t] ?? []) as unknown[]) ?? [];
  if (b.schemaVersion === LATEST_VERSION) return decoded;

  const name = `restore-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const old = new AppDB(name, b.schemaVersion);
  await old.transaction('rw', TABLES.map((t) => old.table(t)), async () => {
    for (const t of TABLES) await old.table(t).bulkAdd(decoded[t]);
  });
  old.close();
  const upgraded = new AppDB(name);
  await upgraded.open();
  const out = {} as Record<TableName, unknown[]>;
  for (const t of TABLES) out[t] = await upgraded.table(t).toArray();
  upgraded.close();
  await Dexie.delete(name);
  return out;
}

/** بيمسح كل البيانات الحالية ويحط بيانات النسخة (إعدادات الجهاز زي الـ PIN بتفضل). */
export async function restoreBackup(b: BackupFile, d: AppDB = db): Promise<void> {
  const tables = await upgradeTables(b);
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
    const keep = await d.settings.where('key').anyOf(DEVICE_SETTINGS).toArray();
    for (const t of TABLES) await d.table(t).clear();
    for (const t of TABLES) {
      let rows = tables[t];
      if (t === 'settings') rows = rows.filter((r) => !DEVICE_SETTINGS.includes((r as { key: string }).key));
      await d.table(t).bulkAdd(rows);
    }
    await d.settings.bulkPut(keep);
  });
}

// ===== نسخة أمان تلقائية قبل أي استرجاع (في قاعدة بيانات منفصلة) =====

interface SafetySnapshot {
  id?: number;
  createdAt: string;
  reason: string;
  json: string;
}

class SafetyDB extends Dexie {
  snapshots!: Dexie.Table<SafetySnapshot, number>;
  constructor() {
    super('meeting-minutes-safety');
    this.version(1).stores({ snapshots: '++id, createdAt' });
  }
}

const KEEP_SNAPSHOTS = 3;
let safety: SafetyDB | null = null;
const safetyDb = () => (safety ??= new SafetyDB());

export async function saveSafetySnapshot(reason: string, appVersion: string, d: AppDB = db): Promise<void> {
  const json = JSON.stringify(await exportBackup(appVersion, d));
  const s = safetyDb();
  await s.snapshots.add({ createdAt: new Date().toISOString(), reason, json });
  const all = await s.snapshots.orderBy('createdAt').toArray();
  const extra = all.length - KEEP_SNAPSHOTS;
  if (extra > 0) await s.snapshots.bulkDelete(all.slice(0, extra).map((x) => x.id!));
}

export async function listSafetySnapshots(): Promise<Omit<SafetySnapshot, 'json'>[]> {
  const all = await safetyDb().snapshots.orderBy('createdAt').reverse().toArray();
  return all.map(({ id, createdAt, reason }) => ({ id, createdAt, reason }));
}

export async function getSafetySnapshot(id: number): Promise<BackupFile | undefined> {
  const s = await safetyDb().snapshots.get(id);
  if (!s) return undefined;
  const parsed = parseBackup(s.json);
  return parsed.ok ? parsed.backup : undefined;
}

/** الاسترجاع الآمن: نسخة أمان من البيانات الحالية الأول، وبعدين الاسترجاع. */
export async function safeRestore(b: BackupFile, appVersion: string, d: AppDB = db): Promise<void> {
  await saveSafetySnapshot('before-restore', appVersion, d);
  await restoreBackup(b, d);
}

/** مسح كل البيانات (لما الـ PIN يتنسي) — مع نسخة أمان في الأول. */
export async function wipeAllData(appVersion: string, d: AppDB = db): Promise<void> {
  await saveSafetySnapshot('before-wipe', appVersion, d);
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) await d.table(t).clear();
  });
}

// ===== سلسلة واحدة (إعدادات فقط) =====

export interface SeriesFile {
  format: typeof SERIES_FORMAT;
  schemaVersion: number;
  exportedAt: string;
  series: Pick<Series, 'name' | 'taskPrefix' | 'recurrence' | 'defaultTopics' | 'colors' | 'sections' | 'registerName'>;
  members: Pick<Person, 'name' | 'title' | 'position' | 'email'>[];
}

export async function exportSeriesFile(seriesId: string, d: AppDB = db): Promise<SeriesFile> {
  const s = await d.series.get(seriesId);
  if (!s) throw new Error('Series not found');
  const people = await d.people.bulkGet(s.memberIds);
  return {
    format: SERIES_FORMAT,
    schemaVersion: LATEST_VERSION,
    exportedAt: new Date().toISOString(),
    series: {
      name: s.name,
      taskPrefix: s.taskPrefix,
      recurrence: s.recurrence,
      defaultTopics: s.defaultTopics,
      colors: s.colors,
      sections: s.sections,
      registerName: s.registerName,
    },
    members: people.filter((p): p is Person => !!p).map(({ name, title, position, email }) => ({ name, title, position, email })),
  };
}

export function parseSeriesFile(text: string): SeriesFile | null {
  try {
    const f = JSON.parse(text) as Partial<SeriesFile>;
    if (f.format !== SERIES_FORMAT || !f.series?.name || !f.series.taskPrefix || !Array.isArray(f.members)) return null;
    return f as SeriesFile;
  } catch {
    return null;
  }
}

/**
 * استيراد إعدادات سلسلة: الأعضاء الموجودين في الدليل (بنفس الاسم) بيتستخدموا، والجداد بيتضافوا.
 * السلسلة الجديدة بتبدأ من غير اجتماعات ولا مهام (العدادات صفر).
 */
export async function importSeriesFile(f: SeriesFile, d: AppDB = db): Promise<{ series: Series; addedPeople: number }> {
  return d.transaction('rw', d.people, d.series, async () => {
    const existing = await d.people.toArray();
    const byKey = new Map(existing.map((p) => [nameKey(p.name), p]));
    const memberIds: string[] = [];
    let addedPeople = 0;
    for (const m of f.members) {
      const key = nameKey(m.name);
      let p = byKey.get(key);
      if (!p) {
        p = { id: newId(), name: m.name.trim(), title: m.title ?? '', position: m.position ?? '', email: m.email ?? '', active: true, createdAt: Date.now() };
        await d.people.add(p);
        byKey.set(key, p);
        addedPeople++;
      }
      if (!memberIds.includes(p.id)) memberIds.push(p.id);
    }
    const now = Date.now();
    const series: Series = {
      ...f.series,
      id: newId(),
      memberIds,
      firstMeetingDate: undefined,
      taskCounter: 0,
      meetingCounter: 0,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await d.series.add(series);
    return { series, addedPeople };
  });
}
