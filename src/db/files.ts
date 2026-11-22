// الملفات المصدّرة: نسخة من كل ملف بيتصدّر (محضر، متابعة، نسخة احتياطية، تقويم…) جوه التطبيق.
// قاعدة منفصلة (زي نسخ الأمان): مش بتدخل في النسخة الاحتياطية، ومش بتغيّر schema البيانات.
import Dexie from 'dexie';

export type FileKind = 'minutes' | 'followup' | 'backup' | 'series' | 'calendar' | 'other';

export interface StoredFile {
  id?: number;
  name: string;
  type: string;
  size: number;
  kind: FileKind;
  /** اسم السلسلة (للتجميع)؛ فاضي للنسخ الاحتياطية */
  seriesName?: string;
  createdAt: number;
  data: ArrayBuffer;
}

export type FileMeta = Omit<StoredFile, 'data'>;

class FilesDB extends Dexie {
  files!: Dexie.Table<StoredFile, number>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ files: '++id, createdAt, seriesName' });
  }
}

export const FILES_DB_NAME = 'meeting-minutes-files';
let instance: FilesDB | null = null;
let dbName = FILES_DB_NAME;
const fdb = () => (instance ??= new FilesDB(dbName));

/** للاختبارات: قاعدة باسم تاني. */
export function useFilesDbName(name: string): void {
  instance?.close();
  instance = null;
  dbName = name;
}

export async function saveExportedFile(blob: Blob, name: string, meta: { kind: FileKind; seriesName?: string }): Promise<number> {
  const data = await blob.arrayBuffer();
  return fdb().files.add({ name, type: blob.type || 'application/octet-stream', size: data.byteLength, kind: meta.kind, seriesName: meta.seriesName, createdAt: Date.now(), data });
}

/** القايمة من غير محتوى الملفات (الأحدث الأول). */
export async function listFiles(): Promise<FileMeta[]> {
  const out: FileMeta[] = [];
  await fdb()
    .files.orderBy('createdAt')
    .reverse()
    .each(({ data: _d, ...meta }) => {
      out.push(meta);
    });
  return out;
}

export async function getFileBlob(id: number): Promise<{ blob: Blob; name: string } | undefined> {
  const f = await fdb().files.get(id);
  return f ? { blob: new Blob([f.data], { type: f.type }), name: f.name } : undefined;
}

export async function deleteFiles(ids: number[]): Promise<void> {
  await fdb().files.bulkDelete(ids);
}

/** يمسح الملفات الأقدم من عدد أيام؛ بيرجّع عددها. */
export async function deleteFilesOlderThan(days: number, now = Date.now()): Promise<number> {
  return fdb()
    .files.where('createdAt')
    .below(now - days * 86_400_000)
    .delete();
}

export async function clearAllFiles(): Promise<void> {
  await fdb().files.clear();
}

/** نسبة استخدام مساحة التطبيق (0..1) — undefined لو المتصفح مش بيقولها. */
export async function storageRatio(): Promise<number | undefined> {
  const est = await navigator.storage?.estimate?.();
  if (!est?.quota || est.usage === undefined) return undefined;
  return est.usage / est.quota;
}

export const STORAGE_WARN_RATIO = 0.8;
