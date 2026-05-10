import type { ClipboardReader } from './ClipboardReader.js';
import { MacOSClipboardReader } from './MacOSClipboardReader.js';
import { LinuxX11ClipboardReader } from './LinuxX11ClipboardReader.js';
import { LinuxWaylandClipboardReader } from './LinuxWaylandClipboardReader.js';
import { WindowsClipboardReader } from './WindowsClipboardReader.js';

export type { ClipboardReader } from './ClipboardReader.js';

export function createClipboardReader(): ClipboardReader {
  const platform = process.platform;

  if (platform === 'darwin') {
    return new MacOSClipboardReader();
  }

  if (platform === 'win32') {
    return new WindowsClipboardReader();
  }

  // Linux: check for Wayland
  if (platform === 'linux') {
    if (process.env.WAYLAND_DISPLAY) {
      return new LinuxWaylandClipboardReader();
    }
    return new LinuxX11ClipboardReader();
  }

  // Fallback: X11 on other Unix-like systems
  return new LinuxX11ClipboardReader();
}
