// قاعدة البيانات ونظام الترقية (migrations).
//
// قواعد إضافة نسخة جديدة:
// 1. ضيف عنصر جديد في آخر SCHEMA_VERSIONS برقم أكبر. متعدّلش نسخة قديمة أبداً.
// 2. لو فيه تحويل بيانات، اكتبه في upgrade، وخلّيه يحافظ على كل البيانات القديمة.
// 3. ضيف اختبار في tests/migrations.test.ts: افتح على النسخة القديمة، ضيف بيانات، افتح على الجديدة، اتأكد إنها سليمة.
import Dexie, { type EntityTable, type Transaction } from 'dexie';
import type {
  Attendance,
  Decision,
  Meeting,
  Org,
  Person,
  RegisterItem,
  Series,
  SettingRow,
  Task,
  TaskUpdate,
} from './types';

export interface SchemaVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (tx: Transaction) => Promise<void> | void;
}

export const SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: 1,
    stores: {
      org: 'id',
      people: 'id, name',
      series: 'id, name',
      meetings: 'id, seriesId, [seriesId+number], date',
      attendance: 'id, meetingId, personId',
      tasks: 'id, seriesId, ownerId, status, meetingId, [seriesId+number]',
      taskUpdates: 'id, taskId, meetingId',
      decisions: 'id, meetingId, taskId',
      registerItems: 'id, seriesId, meetingId',
      settings: 'key',
    },
  },
];

export const LATEST_VERSION = SCHEMA_VERSIONS[SCHEMA_VERSIONS.length - 1].version;
export const DB_NAME = 'meeting-minutes';

export class AppDB extends Dexie {
  org!: EntityTable<Org, 'id'>;
  people!: EntityTable<Person, 'id'>;
  series!: EntityTable<Series, 'id'>;
  meetings!: EntityTable<Meeting, 'id'>;
  attendance!: EntityTable<Attendance, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  taskUpdates!: EntityTable<TaskUpdate, 'id'>;
  decisions!: EntityTable<Decision, 'id'>;
  registerItems!: EntityTable<RegisterItem, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  /** upTo: للاختبارات فقط — فتح القاعدة على نسخة قديمة. */
  constructor(name = DB_NAME, upTo = LATEST_VERSION) {
    super(name);
    for (const v of SCHEMA_VERSIONS) {
      if (v.version > upTo) break;
      const s = this.version(v.version).stores(v.stores);
      if (v.upgrade) s.upgrade(v.upgrade);
    }
  }
}

export const db = new AppDB();

export function newId(): string {
  return crypto.randomUUID();
}
