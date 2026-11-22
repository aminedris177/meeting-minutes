// الألقاب، وتحليل قائمة أسامي ملصوقة (اسم في كل سطر).

/** الألقاب المتاحة. '' = بدون لقب. «أ/» = أستاذ (Mr.)، «أة/» = أستاذة (Ms.). */
export const TITLES = ['', 'أ/', 'أة/', 'م/', 'د/'] as const;
export type Title = (typeof TITLES)[number];

// كل نمط بيطابق اللقب في أول الاسم، ومعاه المسافة/الفاصل اللي بعده.
const TITLE_PATTERNS: [RegExp, Title][] = [
  // أستاذة: الرمز المخزّن «أة/» أو الكلمة كاملة
  [/^[أا]\s*ة\s*[/.]\s*/, 'أة/'],
  [/^(?:ال)?(?:أ|ا)ستاذ[ةه]\s+/, 'أة/'],
  // صيغ مختصرة: أ/ ، أ. ، ا/ ، م/ ، م. ، د/ ، د.  (مع أو بدون مسافة بعدها)
  [/^[أاإ]\s*[/.]\s*/, 'أ/'],
  [/^م\s*[/.]\s*/, 'م/'],
  [/^د\s*[/.]\s*/, 'د/'],
  // كلمات كاملة
  [/^(?:ال)?(?:أ|ا)ستاذ\s+/, 'أ/'],
  [/^(?:ال)?مهندس[ةه]?\s+/, 'م/'],
  [/^(?:ال)?دكتور[ةه]?\s+/, 'د/'],
  // حرف لوحده وبعده مسافة: «م فلان»
  [/^[أا]\s+/, 'أ/'],
  [/^م\s+/, 'م/'],
  [/^د\s+/, 'د/'],
  // إنجليزي
  [/^(?:eng|engr)\.?\s+/i, 'م/'],
  [/^dr\.?\s+/i, 'د/'],
  [/^(?:mrs|ms|miss)\.?\s+/i, 'أة/'],
  [/^mr\.?\s+/i, 'أ/'],
];

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** يفصل اللقب عن الاسم: «م/ فلان الفلاني» → { title: 'م/', name: 'فلان الفلاني' } */
export function splitTitle(raw: string): { title: Title; name: string } {
  const s = collapse(raw);
  for (const [re, title] of TITLE_PATTERNS) {
    const m = re.exec(s);
    // لازم يفضل اسم بعد اللقب
    if (m && s.length > m[0].length) return { title, name: collapse(s.slice(m[0].length)) };
  }
  return { title: '', name: s };
}

/** يحوّل أي لقب قديم أو مكتوب بشكل مختلف للشكل الموحّد: «م.» → «م/». غير معروف → كما هو. */
export function normalizeTitle(raw: string): string {
  const s = collapse(raw);
  if (!s) return '';
  const { title, name } = splitTitle(`${s} _`);
  return title && name === '_' ? title : s;
}

export interface ParsedPerson {
  title: Title;
  name: string;
  position: string;
}

// ترقيم أو نقط في أول السطر: «1. » «2) » «- » «• » «١- »
const BULLET_RE = /^\s*(?:[-*•▪◦·]+|[0-9٠-٩]+\s*[.)\-:،])\s*/;

/**
 * يحلل نص ملصوق: اسم في كل سطر.
 * - بيشيل الترقيم والنقط من أول السطر.
 * - لو السطر فيه Tab (منسوخ من Excel): العمود الأول الاسم، والتاني المسمى/القسم.
 * - اللقب بيتعرف من أول الاسم.
 */
export function parseNameList(text: string): ParsedPerson[] {
  const out: ParsedPerson[] = [];
  for (const line of text.split(/\r?\n/)) {
    const [first = '', second = ''] = line.split('\t');
    const cleaned = first.replace(BULLET_RE, '');
    const { title, name } = splitTitle(cleaned);
    if (!name) continue;
    out.push({ title, name, position: collapse(second) });
  }
  return out;
}

/** مفتاح مقارنة للأسماء: بيتجاهل الهمزات والتاء المربوطة والمسافات الزيادة. */
export function nameKey(name: string): string {
  return collapse(name)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْـ]/g, '') // تشكيل وتطويل
    .toLowerCase();
}
