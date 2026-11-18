// تصغير الصور قبل التخزين (اللوجو) — علشان قاعدة البيانات والمحاضر تفضل خفيفة.
import { useEffect, useState } from 'preact/hooks';

export const LOGO_MAX_SIDE = 480;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Cannot decode image'));
    };
    img.src = url;
  });
}

/**
 * تصغير لحد maxSide بكسل للضلع الأطول.
 * PNG يفضل PNG (اللوجوهات غالباً بخلفية شفافة)، وأي نوع تاني → JPEG بجودة 0.85.
 */
export async function resizeImage(file: Blob, maxSide = LOGO_MAX_SIDE): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  const keepPng = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp';
  if (!keepPng) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const type = keepPng ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  if (!blob) throw new Error('Cannot encode image');
  // لو الأصل أصغر من الناتج ومش محتاج تصغير، خلّي الأصل
  return scale === 1 && file.size <= blob.size && /^image\/(png|jpeg)$/.test(file.type) ? file : blob;
}

/** رابط مؤقت لعرض Blob، بيتنضف تلقائياً. */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
