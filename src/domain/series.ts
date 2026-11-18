// قيم افتراضية وتحقق لإعدادات السلسلة.
import type { Series, SeriesColors, SeriesSections } from '../db/types';

export const DEFAULT_COLORS: SeriesColors = { primary: '#1F3864', secondary: '#0E7C86' };
/** ألوان ثابتة للمحضر (فاتح وكريمي) */
export const LIGHT_COLOR = '#EEF4F7';
export const CREAM_COLOR = '#FFF8E8';

export const DEFAULT_SECTIONS: SeriesSections = {
  decisions: true,
  newTasks: true,
  register: false,
  signatures: true,
};

export const PREFIX_MAX = 6;
/** حروف إنجليزية أو أرقام، تبدأ بحرف. بدون شرطة (الشرطة بتتضاف تلقائياً: Y-01). */
const PREFIX_RE = /^[A-Z][A-Z0-9]*$/;

export function normalizePrefix(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidPrefix(p: string): boolean {
  return p.length >= 1 && p.length <= PREFIX_MAX && PREFIX_RE.test(p);
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export function isValidColor(c: string): boolean {
  return HEX_RE.test(c);
}

export type SeriesDraft = Omit<Series, 'id' | 'taskCounter' | 'meetingCounter' | 'archived' | 'createdAt' | 'updatedAt'>;

export function emptySeriesDraft(): SeriesDraft {
  return {
    name: '',
    taskPrefix: '',
    recurrence: { kind: 'weekly' },
    firstMeetingDate: undefined,
    memberIds: [],
    defaultTopics: [],
    colors: { ...DEFAULT_COLORS },
    sections: { ...DEFAULT_SECTIONS },
    registerName: '',
  };
}
