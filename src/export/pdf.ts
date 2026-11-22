// PDF: المستند بيترسم HTML في مكان مخفي، بيتقسم لصفحات A4 (من غير قطع صفوف)،
// كل صفحة بتتصور بـ html2canvas كـ JPEG مضغوط، وبتتجمع بـ jsPDF.
import { h, render, type VNode } from 'preact';
import { FollowupReport } from '../components/FollowupReport';
import { MinutesView } from '../components/MinutesView';
import { db } from '../db/schema';
import { buildFollowupData } from './followupData';
import type { MinutesModel } from '../db/types';
import { fmt, t } from '../i18n';
import { waitForAssets } from '../lib/print';
import { A4_LANDSCAPE, A4_PORTRAIT, paginate, type PageSize } from './paginate';
import { minutesFileName, safeFileName, shareOrDownload } from './share';

/** دقة التصوير: 1.7 = نص واضح على الموبايل، والـ JPEG بجودة 0.72 = حجم صغير للواتساب */
const CAPTURE_SCALE = 1.7;
const JPEG_QUALITY = 0.72;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderPdf(vnode: VNode<any>, size: PageSize, footer: (p: number, n: number) => string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

  // مسرح مخفي برّه الشاشة (مش opacity 0 — علشان html2canvas يرسمه)
  const stage = document.createElement('div');
  Object.assign(stage.style, { position: 'fixed', top: '0', left: '-30000px', zIndex: '-1', pointerEvents: 'none' });
  document.body.appendChild(stage);
  const src = document.createElement('div');
  stage.appendChild(src);
  try {
    render(vnode, src);
    const sourceEl = src.firstElementChild as HTMLElement;
    await waitForAssets(sourceEl);

    const pagesHost = document.createElement('div');
    stage.appendChild(pagesHost);
    const pages = paginate(sourceEl, pagesHost, {
      size,
      pageClass: sourceEl.className,
      continued: t().report.continued,
      footer,
    });
    src.style.display = 'none';

    const landscape = size.width > size.height;
    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
    const [wMm, hMm] = landscape ? [297, 210] : [210, 297];
    for (const [i, page] of pages.entries()) {
      const canvas = await html2canvas(page, {
        scale: CAPTURE_SCALE,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: size.width,
        height: size.height,
        windowWidth: size.width,
      });
      if (i > 0) pdf.addPage('a4', landscape ? 'landscape' : 'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, 0, wMm, hMm, undefined, 'FAST');
    }
    return pdf.output('blob');
  } finally {
    render(null, src);
    stage.remove();
  }
}

export async function minutesPdfBlob(model: MinutesModel, logoUrl?: string): Promise<Blob> {
  const m = t().minutes;
  return renderPdf(h(MinutesView, { model, logoUrl }), A4_PORTRAIT, (p, n) =>
    `${model.seriesName} — ${m.title} ${model.number}   ·   ${fmt(m.page, { n: p, total: n })}`,
  );
}

export async function exportMinutesPdf(model: MinutesModel, logoUrl?: string): Promise<void> {
  const blob = await minutesPdfBlob(model, logoUrl);
  await shareOrDownload(blob, minutesFileName(model.seriesName, model.date, 'pdf'), `${model.seriesName} — ${model.number}`, { kind: 'minutes', seriesName: model.seriesName });
}

// ===== ملف المتابعة لكل سلسلة =====

export async function exportFollowupPdf(seriesId: string): Promise<void> {
  const data = await buildFollowupData(seriesId);
  const logo = (await db.org.get('org'))?.logo;
  const logoUrl = logo ? URL.createObjectURL(logo) : undefined;
  try {
    const f = t().report;
    const blob = await renderPdf(h(FollowupReport, { data, logoUrl }), A4_LANDSCAPE, (p, n) =>
      `${data.series.name} — ${f.title}   ·   ${fmt(t().minutes.page, { n: p, total: n })}`,
    );
    await shareOrDownload(blob, `${safeFileName(`${t().xlsx.filePrefix}_${data.series.name}_${data.today}`)}.pdf`, f.title, { kind: 'followup', seriesName: data.series.name });
  } finally {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
  }
}
