// ملف المتابعة Excel لسلسلة: شيت «المتابعة» (المفتوح) وشيت «المغلق» — بنفس أعمدة ملف المتابعة
// المرجعي، علشان نفس الملف يقدر يتستورد تاني في التطبيق.
import type { FollowupData } from '../components/FollowupReport';
import { displayName } from '../db/repos/people';
import { isOpen } from '../domain/delay';
import { isRtl, t } from '../i18n';
import { formatDate } from '../lib/dates';
import { buildXlsx, type XCell } from './xlsxWrite';

export function buildFollowupXlsx(data: FollowupData): Uint8Array {
  const x = t().xlsx;
  const st = t().task.statuses;
  const rtl = isRtl();
  const open = data.rows.filter((r) => isOpen(r.task));
  const closed = data.rows.filter((r) => !isOpen(r.task));
  const owner = (r: (typeof data.rows)[number]) => (r.owner ? displayName(r.owner) : '');
  const date = (d?: string): XCell => (d ? { date: d } : null);
  const titleRows = [`${t().report.title} — ${data.series.name}`, `${data.orgName ? data.orgName + ' · ' : ''}${t().report.date}: ${formatDate(data.today)}`];

  return buildXlsx([
    {
      name: x.openSheet,
      rtl,
      titleRows,
      headerColor: data.series.colors.primary,
      columns: [
        { header: x.code, width: 9 },
        { header: x.topic, width: 16 },
        { header: x.task, width: 42 },
        { header: x.owner, width: 18 },
        { header: x.created, width: 13 },
        { header: x.target, width: 13 },
        { header: x.status, width: 14 },
        { header: x.delay, width: 10 },
        { header: x.latest, width: 42 },
        { header: x.next, width: 32 },
      ],
      rows: open.map((r) => [
        r.task.code,
        r.task.topic,
        r.task.description,
        owner(r),
        date(r.task.createdDate),
        date(r.task.targetDate),
        st[r.task.status],
        r.delay > 0 ? r.delay : null,
        r.latest?.text ?? '',
        r.latest?.nextAction ?? '',
      ]),
      highlightRows: new Set(open.map((r, i) => (r.delay > 0 ? i : -1)).filter((i) => i >= 0)),
    },
    {
      name: x.closedSheet,
      rtl,
      headerColor: data.series.colors.secondary,
      columns: [
        { header: x.code, width: 9 },
        { header: x.topic, width: 16 },
        { header: x.task, width: 42 },
        { header: x.owner, width: 18 },
        { header: x.status, width: 12 },
        { header: x.closed, width: 13 },
        { header: x.result, width: 42 },
      ],
      rows: closed.map((r) => [r.task.code, r.task.topic, r.task.description, owner(r), st[r.task.status], date(r.task.closedDate), r.latest?.text ?? '']),
    },
  ]);
}

export async function exportFollowupXlsx(seriesId: string): Promise<void> {
  const [{ buildFollowupData }, { safeFileName, shareOrDownload }] = await Promise.all([import('./followupData'), import('./share')]);
  const data = await buildFollowupData(seriesId);
  const bytes = buildFollowupXlsx(data);
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  try {
    await shareOrDownload(blob, `${safeFileName(`${t().xlsx.filePrefix}_${data.series.name}_${data.today}`)}.xlsx`, t().report.title, { kind: 'followup', seriesName: data.series.name });
  } catch (e) {
    if ((e as Error).name !== 'AbortError') throw e;
  }
}
