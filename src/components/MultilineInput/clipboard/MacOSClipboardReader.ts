import { spawn } from 'node:child_process';
import type { ClipboardReader } from './ClipboardReader.js';

export class MacOSClipboardReader implements ClipboardReader {
  async read(): Promise<
    | { kind: 'text'; value: string }
    | { kind: 'image'; mimeType: string; bytes: Buffer }
    | { kind: 'empty' }
  > {
    try {
      const png = await spawnAsync('osascript', [
        '-e',
        'get the clipboard as «class PNGf»',
      ]);
      if (png && png.length > 0) {
        const hex = png.toString('utf8').trim();
        // osascript returns hexadecimal representation
        const hexMatch = hex.match(/^«data PNGf([0-9A-Fa-f]*)»$/);
        if (hexMatch) {
          const bytes = Buffer.from(hexMatch[1], 'hex');
          if (bytes.length > 0) {
            return { kind: 'image', mimeType: 'image/png', bytes };
          }
        }
      }
    } catch {
      // Fall through to text-only read
    }

    try {
      const text = await spawnAsync('osascript', [
        '-e',
        'get the clipboard as text',
      ]);
      const str = text?.toString('utf8') ?? '';
      if (str.length > 0) {
        return { kind: 'text', value: str };
      }
    } catch {
      // Fall through
    }

    return { kind: 'empty' };
  }
}

function spawnAsync(cmd: string, args: string[]): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.resume();
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`exit code ${code}`));
      }
    });
  });
}
