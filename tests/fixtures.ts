import type { MinutesModel } from '../src/db/types';

// محضر تجريبي كامل (بيانات وهمية) — بيستخدمه أكتر من اختبار
export const sampleModel: MinutesModel = {
  orgName: 'جهة تجريبية',
  seriesName: 'اجتماع الجودة الأسبوعي',
  colors: { primary: '#1F3864', secondary: '#0E7C86' },
  sections: { decisions: true, newTasks: true, register: true, signatures: true },
  registerName: 'المواصفات المعتمدة',
  number: 7,
  date: '2026-11-17',
  nextDate: '2026-11-24',
  topics: ['متابعة المؤشرات', 'شكاوى العملاء'],
  notes: 'ملاحظة أولى\nملاحظة تانية',
  attendees: [
    { name: 'م/ شخص أول', position: 'قسم', present: true, guest: false },
    { name: 'د/ شخص ثاني', position: '', present: true, guest: false },
    { name: 'شخص ثالث', position: '', present: false, guest: false },
    { name: 'ضيف خارجي', position: '', present: true, guest: true },
    { name: 'شخص خامس', position: '', present: true, guest: false },
  ],
  review: [
    { code: 'Q-01', topic: 'متابعة المؤشرات', owner: 'م/ شخص أول', update: 'تم تحليل البيانات، والعيوب نزلت 2%', nextAction: 'عرض خطة التحسين', status: 'in_progress', targetDate: '2026-11-10', delay: 7 },
    { code: 'Q-02', topic: '', owner: '', update: '', nextAction: '', status: 'done', delay: 0 },
    { code: 'Q-100', topic: 'شكاوى العملاء', owner: 'د/ شخص ثاني', update: 'في انتظار رد المورد', nextAction: '', status: 'blocked', delay: 0 },
  ],
  decisions: [{ text: 'اعتماد خطة التحسين اعتباراً من الأسبوع القادم', taskCode: 'Q-01' }, { text: 'قرار من غير مهمة' }],
  newTasks: [{ code: 'Q-101', topic: 'متابعة المؤشرات', description: 'تدريب المشغلين على الإجراء الجديد', owner: 'شخص خامس', targetDate: '2026-11-30', priority: 'high' }],
  register: [
    { item: 'مواصفة الخيط 30/1', text: 'نسبة الرطوبة 8.5% ± 0.5', status: 'approved', isNew: true },
    { item: 'مواصفة قديمة', text: 'نص', status: 'amended', isNew: false },
  ],
  status: 'final',
};
