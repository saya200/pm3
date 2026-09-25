// ضغط الصور داخل المتصفح قبل الرفع: أبعاد أقصاها 1280px وJPEG بجودة متدرجة
export interface CompressedImage {
  dataUrl: string;
  width: number;
  height: number;
}

export const MAX_IMAGE_CHARS = 450_000; // ~330KB فعليًا — حد قواعد Firestore هو 900 ألف حرف

async function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* نجرب الطريقة التقليدية */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function compressImage(file: Blob, maxDim = 1280): Promise<CompressedImage> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('not-image');
  const src = await decode(file);
  let scale = Math.min(1, maxDim / Math.max(src.width, src.height));

  for (let attempt = 0; attempt < 6; attempt++) {
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);
    for (const q of [0.78, 0.68, 0.58]) {
      const dataUrl = canvas.toDataURL('image/jpeg', q);
      if (dataUrl.length <= MAX_IMAGE_CHARS) return { dataUrl, width: w, height: h };
    }
    scale *= 0.75;
  }
  throw new Error('too-large');
}
