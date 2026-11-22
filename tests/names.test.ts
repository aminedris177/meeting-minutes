import { describe, expect, it } from 'vitest';
import { nameKey, normalizeTitle, parseNameList, splitTitle } from '../src/domain/names';

describe('splitTitle', () => {
  it.each([
    ['م/ شخص أول', 'م/', 'شخص أول'],
    ['م/شخص أول', 'م/', 'شخص أول'],
    ['م. شخص أول', 'م/', 'شخص أول'],
    ['م شخص أول', 'م/', 'شخص أول'],
    ['المهندس شخص أول', 'م/', 'شخص أول'],
    ['مهندسة شخص أول', 'م/', 'شخص أول'],
    ['د/ شخص', 'د/', 'شخص'],
    ['د. شخص', 'د/', 'شخص'],
    ['الدكتور شخص', 'د/', 'شخص'],
    ['دكتورة شخص', 'د/', 'شخص'],
    ['أ/ شخص', 'أ/', 'شخص'],
    ['ا/ شخص', 'أ/', 'شخص'],
    ['أ. شخص', 'أ/', 'شخص'],
    ['الأستاذ شخص', 'أ/', 'شخص'],
    ['استاذة شخص', 'أة/', 'شخص'],
    ['أستاذ شخص', 'أ/', 'شخص'],
    ['أة/ شخص', 'أة/', 'شخص'],
    ['Ms. Person', 'أة/', 'Person'],
    ['Mrs Person', 'أة/', 'Person'],
    ['Mr. Person', 'أ/', 'Person'],
    ['Eng. Person', 'م/', 'Person'],
    ['Dr Person', 'د/', 'Person'],
    ['Mr. Person', 'أ/', 'Person'],
  ])('%s → %s + %s', (raw, title, name) => {
    expect(splitTitle(raw)).toEqual({ title, name });
  });

  it('does not strip names that merely start with the same letters', () => {
    expect(splitTitle('مدير عام')).toEqual({ title: '', name: 'مدير عام' });
    expect(splitTitle('دليل')).toEqual({ title: '', name: 'دليل' });
    expect(splitTitle('أمان')).toEqual({ title: '', name: 'أمان' });
    expect(splitTitle('مهندسين')).toEqual({ title: '', name: 'مهندسين' });
  });

  it('keeps a lone title as a name rather than an empty name', () => {
    expect(splitTitle('م/')).toEqual({ title: '', name: 'م/' });
  });

  it('collapses whitespace', () => {
    expect(splitTitle('  م/   شخص    أول  ')).toEqual({ title: 'م/', name: 'شخص أول' });
  });
});

describe('normalizeTitle', () => {
  it('maps variants to the standard form', () => {
    expect(normalizeTitle('م.')).toBe('م/');
    expect(normalizeTitle('د.')).toBe('د/');
    expect(normalizeTitle('أ.')).toBe('أ/');
    expect(normalizeTitle('م/')).toBe('م/');
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle('ك.')).toBe('ك.');
  });
});

describe('parseNameList', () => {
  it('parses one name per line with titles, numbering and blanks', () => {
    const text = '1. م/ شخص أول\n2) د. شخص ثاني\n\n- شخص ثالث\n•   أ/ شخص رابع  \n١- شخص خامس\r\n';
    expect(parseNameList(text)).toEqual([
      { title: 'م/', name: 'شخص أول', position: '' },
      { title: 'د/', name: 'شخص ثاني', position: '' },
      { title: '', name: 'شخص ثالث', position: '' },
      { title: 'أ/', name: 'شخص رابع', position: '' },
      { title: '', name: 'شخص خامس', position: '' },
    ]);
  });

  it('reads a second tab-separated column as position (pasted from Excel)', () => {
    expect(parseNameList('م/ شخص أول\tقسم الإنتاج\nشخص ثاني\t')).toEqual([
      { title: 'م/', name: 'شخص أول', position: 'قسم الإنتاج' },
      { title: '', name: 'شخص ثاني', position: '' },
    ]);
  });
});

describe('nameKey', () => {
  it('ignores hamza, taa marbuta, alef maqsura, diacritics and spaces', () => {
    expect(nameKey('أمانة  عامة')).toBe(nameKey('امانه عامه'));
    expect(nameKey('مَعنى')).toBe(nameKey('معني'));
    expect(nameKey('إدارة')).toBe(nameKey('اداره'));
  });
});
