import { describe, expect, it } from 'vitest';
import { compareTaskCodes, formatTaskCode, parseTaskCode } from '../src/domain/numbering';

describe('formatTaskCode', () => {
  it('pads to two digits', () => {
    expect(formatTaskCode('Y', 1)).toBe('Y-01');
    expect(formatTaskCode('Q', 9)).toBe('Q-09');
    expect(formatTaskCode('Y', 99)).toBe('Y-99');
  });
  it('supports more than 99 tasks', () => {
    expect(formatTaskCode('Y', 100)).toBe('Y-100');
    expect(formatTaskCode('QA', 1234)).toBe('QA-1234');
  });
  it('rejects invalid numbers', () => {
    expect(() => formatTaskCode('Y', 0)).toThrow();
    expect(() => formatTaskCode('Y', 1.5)).toThrow();
  });
});

describe('parseTaskCode', () => {
  it('round-trips', () => {
    expect(parseTaskCode('Y-01')).toEqual({ prefix: 'Y', n: 1 });
    expect(parseTaskCode('qa-100')).toEqual({ prefix: 'QA', n: 100 });
    expect(parseTaskCode('Y-00')).toBeNull();
    expect(parseTaskCode('Y01')).toBeNull();
  });
});

describe('compareTaskCodes', () => {
  it('sorts numerically, not alphabetically', () => {
    const codes = ['Y-100', 'Y-10', 'Y-02', 'Y-99', 'Q-05'];
    expect([...codes].sort(compareTaskCodes)).toEqual(['Q-05', 'Y-02', 'Y-10', 'Y-99', 'Y-100']);
  });
});
