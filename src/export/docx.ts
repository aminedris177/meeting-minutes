// تصدير المحضر Word جوه المتصفح (Packer.toBlob) ومشاركته.
import { Packer } from 'docx';
import type { MinutesModel } from '../db/types';
import { buildMinutesDocx, type DocxLogo } from './docxBuild';
import { minutesFileName, shareOrDownload } from './share';

async function readLogo(blob: Blob): Promise<DocxLogo | undefined> {
  try {
    const bmp = await createImageBitmap(blob);
    const data = new Uint8Array(await blob.arrayBuffer());
    const type = blob.type === 'image/png' ? 'png' : 'jpg';
    const out = { data, type, width: bmp.width, height: bmp.height } as const;
    bmp.close();
    return out;
  } catch {
    return undefined;
  }
}

export async function exportMinutesDocx(model: MinutesModel, logo?: Blob): Promise<void> {
  const doc = buildMinutesDocx(model, logo ? await readLogo(logo) : undefined);
  const blob = await Packer.toBlob(doc);
  const typed = new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  await shareOrDownload(typed, minutesFileName(model.seriesName, model.date, 'docx'), `${model.seriesName} — ${model.number}`, { kind: 'minutes', seriesName: model.seriesName });
}
