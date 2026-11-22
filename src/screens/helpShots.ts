// صور دليل الاستخدام (بيانات تجريبية) — public/help/<lang>/<section>-<step>.jpg
// الرقم = ترتيب الخطوة (من 0) اللي الصورة بتظهر تحتها.
export const HELP_SHOTS: Record<string, number[]> = {
  start: [2, 3],
  series: [0, 1, 3, 4],
  meeting: [0, 2, 3, 5, 6],
  followup: [0, 2, 3, 5, 6, 7],
  calendar: [0, 1, 3],
  archive: [0, 1],
  people: [0, 1],
  export: [0, 1],
  import: [1, 2, 3, 4, 5],
  backup: [0],
  pin: [0, 1],
  language: [0],
  appearance: [0, 1],
  update: [3],
};

export const helpShotUrl = (lang: string, section: string, step: number) =>
  `${import.meta.env.BASE_URL}help/${lang}/${section}-${step}.jpg`;
