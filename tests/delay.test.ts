import { describe, expect, it } from 'vitest';
import { delayDays, isOpen, isOverdue } from '../src/domain/delay';

const today = '2026-11-18';

describe('delayDays', () => {
  it('counts days past the target for open tasks', () => {
    expect(delayDays({ status: 'in_progress', targetDate: '2026-11-10' }, today)).toBe(8);
    expect(delayDays({ status: 'not_started', targetDate: '2026-10-31' }, today)).toBe(18);
    expect(delayDays({ status: 'blocked', targetDate: '2026-11-17' }, today)).toBe(1);
  });
  it('is 0 when due today or in the future', () => {
    expect(delayDays({ status: 'in_progress', targetDate: today }, today)).toBe(0);
    expect(delayDays({ status: 'in_progress', targetDate: '2026-12-01' }, today)).toBe(0);
  });
  it('is 0 without a target date', () => {
    expect(delayDays({ status: 'in_progress', targetDate: undefined }, today)).toBe(0);
  });
  it('is 0 for closed tasks', () => {
    expect(delayDays({ status: 'done', targetDate: '2026-01-01' }, today)).toBe(0);
    expect(delayDays({ status: 'cancelled', targetDate: '2026-01-01' }, today)).toBe(0);
  });
  it('counts across year boundaries', () => {
    expect(delayDays({ status: 'in_progress', targetDate: '2026-12-25' }, '2027-01-05')).toBe(11);
  });
});

describe('isOpen / isOverdue', () => {
  it('classifies statuses', () => {
    expect(isOpen({ status: 'not_started' })).toBe(true);
    expect(isOpen({ status: 'blocked' })).toBe(true);
    expect(isOpen({ status: 'done' })).toBe(false);
    expect(isOverdue({ status: 'in_progress', targetDate: '2026-11-17' }, today)).toBe(true);
    expect(isOverdue({ status: 'done', targetDate: '2026-11-17' }, today)).toBe(false);
  });
});
