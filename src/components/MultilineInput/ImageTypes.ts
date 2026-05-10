export interface ImageRef {
  id: string;
  data: string; // base64-encoded
  mimeType: string;
  byteSize: number;
  displayNumber: number;
}

export type PasteErrorReason =
  | 'clipboard-timeout'
  | 'clipboard-read-error'
  | 'clipboard-unsupported-type'
  | 'image-too-large'
  | 'too-many-images'
  | 'clipboard-empty';

export const SENTINEL_OPEN = '\uE000';
export const SENTINEL_CLOSE = '\uE001';
