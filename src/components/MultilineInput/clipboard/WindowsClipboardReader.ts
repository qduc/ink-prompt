import { spawn } from 'node:child_process';
import type { ClipboardReader } from './ClipboardReader.js';

export class WindowsClipboardReader implements ClipboardReader {
  async read(): Promise<
    | { kind: 'text'; value: string }
    | { kind: 'image'; mimeType: string; bytes: Buffer }
    | { kind: 'empty' }
  > {
    // Try Get-Clipboard -Format Image first
    try {
      const png = await spawnAsync('powershell', [
        '-NoProfile',
        '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; ' +
        '$img = [System.Windows.Forms.Clipboard]::GetImage(); ' +
        'if ($img -ne $null) { ' +
        '  $ms = New-Object System.IO.MemoryStream; ' +
        '  $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); ' +
        '  [System.Convert]::ToBase64String($ms.ToArray()); ' +
        '}',
      ]);
      if (png && png.length > 0) {
        const b64 = png.toString('utf8').trim();
        if (b64.length > 0) {
          const bytes = Buffer.from(b64, 'base64');
          if (bytes.length > 0) {
            return { kind: 'image', mimeType: 'image/png', bytes };
          }
        }
      }
    } catch {
      // Fall through
    }

    // Try text as fallback
    try {
      const text = await spawnAsync('powershell', [
        '-NoProfile',
        '-Command',
        'Get-Clipboard',
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
