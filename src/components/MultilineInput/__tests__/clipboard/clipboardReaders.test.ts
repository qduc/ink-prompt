import { describe, it, expect } from 'vitest';

describe('clipboard readers', () => {
  describe('factory', () => {
    it('returns MacOSClipboardReader on darwin', async () => {
      const origPlatform = process.platform;
      try {
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        const { createClipboardReader } = await import('../../clipboard/index.js');
        const reader = createClipboardReader();
        expect(reader.constructor.name).toBe('MacOSClipboardReader');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlatform });
      }
    });

    it('returns WindowsClipboardReader on win32', async () => {
      const origPlatform = process.platform;
      try {
        Object.defineProperty(process, 'platform', { value: 'win32' });
        const { createClipboardReader } = await import('../../clipboard/index.js');
        const reader = createClipboardReader();
        expect(reader.constructor.name).toBe('WindowsClipboardReader');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlatform });
      }
    });

    it('returns LinuxWaylandClipboardReader on linux with WAYLAND_DISPLAY', async () => {
      const origPlatform = process.platform;
      const origEnv = { ...process.env };
      try {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.WAYLAND_DISPLAY = 'wayland-0';
        const { createClipboardReader } = await import('../../clipboard/index.js');
        const reader = createClipboardReader();
        expect(reader.constructor.name).toBe('LinuxWaylandClipboardReader');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlatform });
        process.env = origEnv;
      }
    });

    it('returns LinuxX11ClipboardReader on linux without WAYLAND_DISPLAY', async () => {
      const origPlatform = process.platform;
      const origEnv = { ...process.env };
      try {
        Object.defineProperty(process, 'platform', { value: 'linux' });
        delete process.env.WAYLAND_DISPLAY;
        const { createClipboardReader } = await import('../../clipboard/index.js');
        const reader = createClipboardReader();
        expect(reader.constructor.name).toBe('LinuxX11ClipboardReader');
      } finally {
        Object.defineProperty(process, 'platform', { value: origPlatform });
        process.env = origEnv;
      }
    });
  });

  describe('each reader is constructable and has read method', () => {
    it('MacOSClipboardReader has read method', async () => {
      const { MacOSClipboardReader } = await import('../../clipboard/MacOSClipboardReader.js');
      const reader = new MacOSClipboardReader();
      expect(typeof reader.read).toBe('function');
    });

    it('LinuxX11ClipboardReader has read method', async () => {
      const { LinuxX11ClipboardReader } = await import('../../clipboard/LinuxX11ClipboardReader.js');
      const reader = new LinuxX11ClipboardReader();
      expect(typeof reader.read).toBe('function');
    });

    it('LinuxWaylandClipboardReader has read method', async () => {
      const { LinuxWaylandClipboardReader } = await import('../../clipboard/LinuxWaylandClipboardReader.js');
      const reader = new LinuxWaylandClipboardReader();
      expect(typeof reader.read).toBe('function');
    });

    it('WindowsClipboardReader has read method', async () => {
      const { WindowsClipboardReader } = await import('../../clipboard/WindowsClipboardReader.js');
      const reader = new WindowsClipboardReader();
      expect(typeof reader.read).toBe('function');
    });
  });
});
