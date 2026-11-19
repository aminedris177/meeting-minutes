// نقطة واحدة للتصدير. مكتبات Word والـ PDF تقيلة، فبتتحمّل بس لما تدوس الزرار (lazy import)
// — ومع ذلك متخزنة في الـ Service Worker، فبتشتغل أوفلاين.
import type { MinutesModel } from '../db/types';
import { printMinutes } from '../lib/print';

export type ExportKind = 'word' | 'pdf' | 'print';

export async function exportMinutes(kind: ExportKind, model: MinutesModel, logo?: Blob, logoUrl?: string): Promise<void> {
  if (kind === 'print') return printMinutes(model, logoUrl);
  if (kind === 'word') {
    const { exportMinutesDocx } = await import('./docx');
    return exportMinutesDocx(model, logo);
  }
  const { exportMinutesPdf } = await import('./pdf');
  return exportMinutesPdf(model, logoUrl);
}
