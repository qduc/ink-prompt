import { spawn } from 'node:child_process';
import type { ClipboardReader } from './ClipboardReader.js';

export class LinuxWaylandClipboardReader implements ClipboardReader {
  async read(): Promise<
    | { kind: 'text'; value: string }
    | { kind: 'image'; mimeType: string; bytes: Buffer }
    | { kind: 'empty' }
  > {
    // Try image/png first
    try {
      const png = await spawnAsync('wl-paste', [
        '--type', 'image/png',
      ]);
      if (png && png.length > 0) {
        return { kind: 'image', mimeType: 'image/png', bytes: png };
      }
    } catch {
      // Fall through
    }

    // Try text as fallback
    try {
      const text = await spawnAsync('wl-paste', [
        '--type', 'text/plain',
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
