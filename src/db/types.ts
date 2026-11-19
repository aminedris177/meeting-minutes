// نموذج البيانات — كل الجداول. المعرّفات UUID (تسهّل النسخ الاحتياطي ونقل سلسلة لجهاز تاني).
import type { ISODate } from '../lib/dates';

export type ID = string;

/** الجهة: سجل واحد فقط (id = 'org'). */
export interface Org {
  id: 'org';
  name: string;
  logo?: Blob;
  updatedAt: number;
}

export interface Person {
  id: ID;
  name: string;
  /** اللقب: م. / د. / أ. … */
  title: string;
  /** المسمى الوظيفي أو القسم */
  position: string;
  email: string;
  active: boolean;
  createdAt: number;
}

export type RecurrenceKind = 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface Recurrence {
  kind: RecurrenceKind;
  /** لـ custom فقط: كل N يوم */
  everyDays?: number;
}

export interface SeriesSections {
  decisions: boolean;
  newTasks: boolean;
  register: boolean;
  signatures: boolean;
}

export interface SeriesColors {
  primary: string;
  secondary: string;
}

export interface Series {
  id: ID;
  name: string;
  /** بادئة ترقيم المهام: Y → Y-01 */
  taskPrefix: string;
  recurrence: Recurrence;
  /** تاريخ أول اجتماع (يُستخدم كـ «الاجتماع القادم» لحد ما يتعمل أول اجتماع) */
  firstMeetingDate?: ISODate;
  /** الحضور الثابت بالترتيب */
  memberIds: ID[];
  defaultTopics: string[];
  colors: SeriesColors;
  sections: SeriesSections;
  /** اسم السجل التراكمي: «المواصفات المعتمدة» … */
  registerName: string;
  /** آخر رقم مهمة اتصرف (المهمة الجاية = taskCounter + 1) */
  taskCounter: number;
  /** آخر رقم اجتماع اتصرف */
  meetingCounter: number;
  /** إعدادات «إضافة للتقويم» (الساعة والمدة والتذكير) — بتتفتكر للمرة الجاية */
  calendar?: { time: string; durationMin: number; reminder: 'none' | '15m' | '1h' | '1d' | '1d1h' };
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export type MeetingStatus = 'draft' | 'final';

export interface Meeting {
  id: ID;
  seriesId: ID;
  number: number;
  date: ISODate;
  /** الاجتماع القادم: محسوب من التكرار وقابل للتعديل */
  nextDate?: ISODate;
  nextDateManual?: boolean;
  topics: string[];
  status: MeetingStatus;
  notes: string;
  /** وقت ما بقى نهائي */
  finalizedAt?: number;
  /**
   * لقطة من المحضر وقت ما بقى نهائي — علشان إعادة التصدير من الأرشيف تطلع نفس المحضر
   * بالظبط حتى لو حالات المهام اتغيرت بعد كده. (اللوجو مش جواها — بيتاخد من الجهة.)
   */
  snapshot?: MinutesModel;
  createdAt: number;
  updatedAt: number;
}

// ===== نموذج المحضر (للمعاينة والتصدير Word/PDF) =====

export interface MinutesAttendee {
  name: string;
  /** المسمى أو القسم */
  position: string;
  present: boolean;
  guest: boolean;
}

export interface MinutesReviewRow {
  code: string;
  topic: string;
  owner: string;
  update: string;
  nextAction: string;
  status: TaskStatus;
  targetDate?: ISODate;
  delay: number;
}

export interface MinutesDecision {
  text: string;
  taskCode?: string;
}

export interface MinutesNewTask {
  code: string;
  topic: string;
  description: string;
  owner: string;
  targetDate?: ISODate;
  priority: TaskPriority;
}

export interface MinutesRegisterRow {
  item: string;
  text: string;
  status: RegisterStatus;
  isNew: boolean;
}

export interface MinutesModel {
  orgName: string;
  seriesName: string;
  colors: SeriesColors;
  sections: SeriesSections;
  registerName: string;
  number: number;
  date: ISODate;
  nextDate?: ISODate;
  topics: string[];
  notes: string;
  attendees: MinutesAttendee[];
  review: MinutesReviewRow[];
  decisions: MinutesDecision[];
  newTasks: MinutesNewTask[];
  register: MinutesRegisterRow[];
  status: MeetingStatus;
}

export interface Attendance {
  id: ID;
  meetingId: ID;
  /** فاضي = ضيف لاجتماع واحد */
  personId?: ID;
  guestName?: string;
  guestTitle?: string;
  present: boolean;
  order: number;
}

export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: ID;
  seriesId: ID;
  /** الرقم التسلسلي داخل السلسلة */
  number: number;
  /** الكود الثابت: Y-01 — لا يتغير حتى لو البادئة اتغيرت */
  code: string;
  topic: string;
  description: string;
  /** null = «يُحدَّد» */
  ownerId: ID | null;
  createdDate: ISODate;
  targetDate?: ISODate;
  priority: TaskPriority;
  status: TaskStatus;
  closedDate?: ISODate;
  /** الاجتماع اللي اتفتحت فيه */
  meetingId?: ID;
  createdAt: number;
  updatedAt: number;
}

export interface TaskUpdate {
  id: ID;
  taskId: ID;
  meetingId?: ID;
  text: string;
  /** المطلوب للاجتماع القادم */
  nextAction: string;
  date: ISODate;
  /** لو التحديث ده غيّر الحالة: الحالة الجديدة (والقديمة) — للسجل */
  status?: TaskStatus;
  prevStatus?: TaskStatus;
  createdAt: number;
}

export interface Decision {
  id: ID;
  meetingId: ID;
  text: string;
  taskId?: ID;
  order: number;
}

/** حالة بند السجل التراكمي */
export type RegisterStatus = 'approved' | 'amended' | 'cancelled';

export interface RegisterItem {
  id: ID;
  seriesId: ID;
  /** البند: اسم/عنوان قصير */
  item: string;
  text: string;
  status: RegisterStatus;
  /** الاجتماع اللي اتعتمد (أو اتعدّل) فيه */
  meetingId?: ID;
  createdAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}
