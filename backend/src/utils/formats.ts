export const allowedFormats = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'svg',
] as const;

export type AllowedFormat = typeof allowedFormats[number];

