// ترقيم المهام داخل كل سلسلة: البادئة + رقم بخانتين على الأقل (Y-01 … Y-99، Y-100 …).

export function formatTaskCode(prefix: string, n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid task number: ${n}`);
  return `${prefix}-${String(n).padStart(2, '0')}`;
}

/** "Y-07" → { prefix: "Y", n: 7 }. null لو الشكل غلط. */
export function parseTaskCode(code: string): { prefix: string; n: number } | null {
  const m = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(code.trim());
  if (!m) return null;
  const n = Number(m[2]);
  return n >= 1 ? { prefix: m[1].toUpperCase(), n } : null;
}

/** ترتيب طبيعي للأكواد: Y-2 قبل Y-10 قبل Y-100 */
export function compareTaskCodes(a: string, b: string): number {
  const pa = parseTaskCode(a);
  const pb = parseTaskCode(b);
  if (!pa || !pb) return a.localeCompare(b);
  return pa.prefix.localeCompare(pb.prefix) || pa.n - pb.n;
}
