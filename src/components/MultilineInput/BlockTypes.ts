export type BlockKind = 'paste' | 'image';

export interface PasteBlockEntry {
  kind: 'paste';
  id: string;
  displayNumber: number;
  originalText: string;
  displayText: string;
}

export interface ImageBlockEntry {
  kind: 'image';
  id: string;
  displayNumber: number;
  data: string;
  mimeType: string;
  byteSize: number;
}

export type BlockEntry = PasteBlockEntry | ImageBlockEntry;

export interface BlockState {
  entries: Map<string, BlockEntry>;
  nextPasteNumber: number;
  nextImageNumber: number;
}
