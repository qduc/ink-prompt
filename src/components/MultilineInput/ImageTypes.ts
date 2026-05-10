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


