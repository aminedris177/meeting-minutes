import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  formatDate,
  parseDisplayDate,
  parseISODate,
  startOfWeek,
  toLatinDigits,
} from '../src/lib/dates';

describe('formatDate', () => {
  it('formats as dd/mm/yyyy with Latin digits', () => {
    expect(formatDate('2026-11-16')).toBe('16/11/2026');
    expect(formatDate('2026-01-05')).toBe('05/01/2026');
  });
  it('returns empty string for empty input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
  });
});

describe('parseDisplayDate', () => {
  it('parses dd/mm/yyyy and common separators', () => {
    expect(parseDisplayDate('16/11/2026')).toBe('2026-11-16');
    expect(parseDisplayDate('5-1-2026')).toBe('2026-01-05');
    expect(parseDisplayDate('05.01.2026')).toBe('2026-01-05');
  });
  it('accepts Arabic-Indic digits', () => {
    expect(parseDisplayDate('١٦/١١/٢٠٢٦')).toBe('2026-11-16');
  });
  it('rejects invalid dates', () => {
    expect(parseDisplayDate('31/02/2026')).toBeNull();
    expect(parseDisplayDate('2026-11-16')).toBeNull();
    expect(parseDisplayDate('abc')).toBeNull();
  });
});

describe('parseISODate', () => {
  it('rejects impossible dates', () => {
    expect(() => parseISODate('2026-02-30')).toThrow();
    expect(() => parseISODate('16/11/2026')).toThrow();
  });
});

describe('addDays / diffDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('counts calendar days', () => {
    expect(diffDays('2026-11-01', '2026-11-16')).toBe(15);
    expect(diffDays('2026-11-16', '2026-11-01')).toBe(-15);
    expect(diffDays('2026-11-16', '2026-11-16')).toBe(0);
  });
});

describe('startOfWeek (Saturday)', () => {
  it('returns the Saturday on or before the date', () => {
    // 2026-11-14 is a Saturday
    expect(startOfWeek('2026-11-14')).toBe('2026-11-14');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-14'); // Monday
    expect(startOfWeek('2026-11-20')).toBe('2026-11-14'); // Friday
    expect(startOfWeek('2026-11-21')).toBe('2026-11-21'); // next Saturday
  });
});

describe('toLatinDigits', () => {
  it('converts Arabic-Indic and Persian digits', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toLatinDigits('۱۲۳')).toBe('123');
  });
});
