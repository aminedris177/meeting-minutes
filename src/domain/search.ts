// توحيد النص العربي/الإنجليزي للبحث: من غير تشكيل، والألف/الياء/التاء المربوطة واحد، وحروف صغيرة.
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** كل الكلمات موجودة في النص؟ */
export function matchesQuery(text: string, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const t = normalizeSearch(text);
  return q.split(' ').every((w) => t.includes(w));
}
