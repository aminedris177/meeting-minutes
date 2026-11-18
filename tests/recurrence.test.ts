import { describe, expect, it } from 'vitest';
import { addMonthsClamped, isValidRecurrence, nextMeetingDate } from '../src/domain/recurrence';

describe('nextMeetingDate', () => {
  it('weekly adds 7 days', () => {
    expect(nextMeetingDate('2026-11-16', { kind: 'weekly' })).toBe('2026-11-23');
  });
  it('biweekly adds 14 days across month end', () => {
    expect(nextMeetingDate('2026-11-23', { kind: 'biweekly' })).toBe('2026-12-07');
  });
  it('weekly crosses year end', () => {
    expect(nextMeetingDate('2026-12-28', { kind: 'weekly' })).toBe('2027-01-04');
  });
  it('monthly keeps the same day', () => {
    expect(nextMeetingDate('2026-11-16', { kind: 'monthly' })).toBe('2026-12-16');
    expect(nextMeetingDate('2026-12-16', { kind: 'monthly' })).toBe('2027-01-16');
  });
  it('monthly clamps to the last day of shorter months', () => {
    expect(nextMeetingDate('2026-01-31', { kind: 'monthly' })).toBe('2026-02-28');
    expect(nextMeetingDate('2028-01-31', { kind: 'monthly' })).toBe('2028-02-29'); // leap year
    expect(nextMeetingDate('2026-03-31', { kind: 'monthly' })).toBe('2026-04-30');
  });
  it('custom adds N days', () => {
    expect(nextMeetingDate('2026-11-16', { kind: 'custom', everyDays: 10 })).toBe('2026-11-26');
    expect(nextMeetingDate('2026-11-16', { kind: 'custom', everyDays: 1 })).toBe('2026-11-17');
  });
  it('custom rejects invalid N', () => {
    expect(() => nextMeetingDate('2026-11-16', { kind: 'custom', everyDays: 0 })).toThrow();
    expect(() => nextMeetingDate('2026-11-16', { kind: 'custom' })).toThrow();
    expect(() => nextMeetingDate('2026-11-16', { kind: 'custom', everyDays: 2.5 })).toThrow();
    expect(() => nextMeetingDate('2026-11-16', { kind: 'custom', everyDays: 400 })).toThrow();
  });
});

describe('addMonthsClamped', () => {
  it('handles multiple months and negatives', () => {
    expect(addMonthsClamped('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('isValidRecurrence', () => {
  it('validates custom days only', () => {
    expect(isValidRecurrence({ kind: 'weekly' })).toBe(true);
    expect(isValidRecurrence({ kind: 'custom', everyDays: 21 })).toBe(true);
    expect(isValidRecurrence({ kind: 'custom', everyDays: 0 })).toBe(false);
  });
});
