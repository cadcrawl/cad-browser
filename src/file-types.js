export const CAD_EXTENSIONS = new Set(['.step', '.stp', '.stl', '.3mf']);
export const PDF_EXTENSIONS = new Set(['.pdf']);
export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg']);
export const TEXT_EXTENSIONS = new Set(['.md', '.txt']);

export function classifyExtension(extension) {
  const normalized = extension.toLowerCase();
  if (CAD_EXTENSIONS.has(normalized)) return 'cad';
  if (PDF_EXTENSIONS.has(normalized)) return 'pdf';
  if (IMAGE_EXTENSIONS.has(normalized)) return 'image';
  if (TEXT_EXTENSIONS.has(normalized)) return 'text';
  return 'file';
}

export function canAnalyze(extension) {
  const normalized = extension.toLowerCase();
  return CAD_EXTENSIONS.has(normalized) || PDF_EXTENSIONS.has(normalized) || TEXT_EXTENSIONS.has(normalized);
}
