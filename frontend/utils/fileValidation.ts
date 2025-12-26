const ALLOWED_EXTENSIONS = [
  'png', 'bmp', 'eps', 'gif', 'jpeg', 'jpg', 'svg', 'tiff', 'webp', 
  'psd', 'heic', 'heif', 'avif', 'jxl', 'apng', 
  'jp2', 'j2k', 'jpx', 'pcx', 'dib', 'xbm', 'xpm', 'wbmp',
  'pdf', 'raw', 'cr2', 'nef', 'orf', 'sr2', 'arw', 'dng', 
  'crw', 'raf', 'rw2', 'pef', 'srw', '3fr', 'mrw', 'x3f'
];
// ICO and TGA are blocked at input (backend doesn't support them as input)
// They are still available as output formats
const REJECTED_EXTENSIONS = ['ico', 'tga'];

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isValidFileType(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function isRejectedFileType(filename: string): boolean {
  const ext = getFileExtension(filename);
  return REJECTED_EXTENSIONS.includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function getRejectionMessage(filename: string): string | null {
  const ext = getFileExtension(filename);
  if (ext === 'ico' || ext === 'tga') {
    return 'ICO and TGA files are not supported for upload. Please convert them to PNG or JPG first.';
  }
  return null;
}

