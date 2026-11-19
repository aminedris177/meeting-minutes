import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ar } from '../src/i18n/ar';
import { en } from '../src/i18n/en';
import { HELP_SHOTS } from '../src/screens/helpShots';

describe('help screenshots', () => {
  it('every listed shot exists in both languages and points to a real step', () => {
    for (const [lang, m] of [['ar', ar], ['en', en]] as const) {
      for (const [id, steps] of Object.entries(HELP_SHOTS)) {
        const sec = m.help.sections.find((s) => s.id === id);
        expect(sec, `${lang}/${id}`).toBeTruthy();
        for (const i of steps) {
          expect(i).toBeLessThan(sec!.steps.length);
          expect(existsSync(`public/help/${lang}/${id}-${i}.jpg`), `${lang}/${id}-${i}`).toBe(true);
        }
      }
    }
  });
});
