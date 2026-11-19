// تغيير لغة التطبيق: بيتحفظ في الإعدادات (بيدخل في النسخة الاحتياطية) وعلى الجهاز (للفتح السريع)،
// والتطبيق كله بيترسم من جديد بالاتجاه الصح.
import { useEffect, useState } from 'preact/hooks';
import { getSetting, SETTING, setSetting } from '../db/repos/settings';
import { getLang, isLang, setLang, type Lang } from '../i18n';

const EVENT = 'app-langchange';

export async function applyLanguage(lang: Lang): Promise<void> {
  setLang(lang);
  await setSetting(SETTING.lang, lang);
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** اللغة الحالية كـ state — أي تغيير بيعيد رسم المكوّن. */
export function useLang(): Lang {
  const [lang, setState] = useState<Lang>(getLang());
  useEffect(() => {
    const on = () => setState(getLang());
    window.addEventListener(EVENT, on);
    // بعد استرجاع نسخة احتياطية على جهاز جديد: لغة النسخة هي الأصح
    void getSetting<string>(SETTING.lang).then((v) => {
      if (isLang(v) && v !== getLang()) {
        setLang(v);
        on();
      }
    });
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return lang;
}
