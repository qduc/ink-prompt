export interface ClipboardReader {
  read(): Promise<
    | { kind: 'text'; value: string }
    | { kind: 'image'; mimeType: string; bytes: Buffer }
    | { kind: 'empty' }
  >;
}
