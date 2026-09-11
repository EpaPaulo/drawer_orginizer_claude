/**
 * A fotografia serve de referência ao lado do esquema enquanto se escolhe o
 * conteúdo. É reduzida antes de ser guardada — fica no armazenamento do
 * navegador e nunca é enviada para lado nenhum.
 */

const MAX_EDGE_PX = 1400;
const JPEG_QUALITY = 0.82;

export async function readPhotoAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolhe um ficheiro de imagem.');
  }

  // 'from-image' respeita a orientação EXIF, para as fotos de telemóvel não
  // aparecerem deitadas.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.');
    context.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
