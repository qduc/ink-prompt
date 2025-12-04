import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKey, KeyHandlerActions } from '../KeyHandler';
import { Buffer, Key } from '../types';

describe('KeyHandler', () => {
  let actions: KeyHandlerActions;
  let buffer: Buffer;

  beforeEach(() => {
    actions = {
      insert: vi.fn(),
      delete: vi.fn(),
      newLine: vi.fn(),
      moveCursor: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      setText: vi.fn(),
      submit: vi.fn(),
    };
    buffer = { lines: [''] };
  });

  describe('Navigation', () => {
    it('handles ArrowUp', () => {
      handleKey({ upArrow: true }, 'up', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('up');
    });

    it('handles ArrowDown', () => {
      handleKey({ downArrow: true }, 'down', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('down');
    });

    it('handles ArrowLeft', () => {
      handleKey({ leftArrow: true }, 'left', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('left');
    });

    it('handles ArrowRight', () => {
      handleKey({ rightArrow: true }, 'right', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('right');
    });

    it('handles Home', () => {
      // Ink doesn't have a specific 'home' property usually, but we check for special keys
      // Often represented as key.home if using a specific library or just checking input
      // For Ink's useInput, we might receive specific sequences.
      // Assuming we handle it via checking `key` object properties if available, or input string if it maps.
      // However, standard Ink `Key` interface has `home` and `end`?
      // Let's assume standard Ink Key interface.
      handleKey({ home: true }, '', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('lineStart');
    });

    it('handles End', () => {
      handleKey({ end: true }, '', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('lineEnd');
    });
  });

  describe('Editing', () => {
    it('handles Backspace', () => {
      handleKey({ backspace: true }, 'backspace', buffer, actions);
      expect(actions.delete).toHaveBeenCalled();
    });

    it('handles Delete', () => {
      handleKey({ delete: true }, 'delete', buffer, actions);
      expect(actions.delete).toHaveBeenCalled(); // Our current simple delete handles backspace, we might need forward delete later
    });

    it('handles Ctrl+J (NewLine)', () => {
      handleKey({ ctrl: true }, 'j', buffer, actions);
      expect(actions.newLine).toHaveBeenCalled();
    });

    it('handles regular text insertion', () => {
      handleKey({}, 'a', buffer, actions);
      expect(actions.insert).toHaveBeenCalledWith('a');
    });

    it('ignores control keys without text', () => {
      handleKey({ ctrl: true }, '', buffer, actions);
      expect(actions.insert).not.toHaveBeenCalled();
    });
  });

  describe('History', () => {
    it('handles Ctrl+Z (Undo)', () => {
      handleKey({ ctrl: true }, 'z', buffer, actions);
      expect(actions.undo).toHaveBeenCalled();
    });

    it('handles Ctrl+Y (Redo)', () => {
      handleKey({ ctrl: true }, 'y', buffer, actions);
      expect(actions.redo).toHaveBeenCalled();
    });
  });

  describe('Submission', () => {
    it('handles Enter as submit by default', () => {
      buffer = { lines: ['hello'] };
      handleKey({ return: true }, 'return', buffer, actions);
      expect(actions.submit).toHaveBeenCalled();
      expect(actions.newLine).not.toHaveBeenCalled();
    });

    it('handles Enter as newline if line ends with backslash', () => {
      buffer = { lines: ['hello\\'] };
      const cursor = { line: 0, column: 6 };

      handleKey({ return: true }, 'return', buffer, actions, cursor);

      // It should probably remove the backslash first.
      // Since we are mocking actions, we can't easily verify the state change between calls unless we implement a fake.
      // But we can check call order.
      expect(actions.delete).toHaveBeenCalled();
      expect(actions.newLine).toHaveBeenCalled();
      expect(actions.submit).not.toHaveBeenCalled();
    });

    it('handles Enter as newline if line ends with backslash (multiple lines)', () => {
        // Cursor is implicitly at the end for this logic usually, or we need to pass cursor to handleKey?
        // The plan says `handleKey` takes `buffer`. It probably needs `cursor` too to know which line we are on?
        // Ah, `TextBuffer` logic usually needs cursor.
        // If `handleKey` decides based on "current line", it needs to know the current line.
        // So `handleKey` signature should probably include `cursor`.

        const cursor = { line: 1, column: 6 };
        buffer = { lines: ['first', 'second\\'] };

        handleKey({ return: true }, 'return', buffer, actions, cursor);

        expect(actions.delete).toHaveBeenCalled();
        expect(actions.newLine).toHaveBeenCalled();
        expect(actions.submit).not.toHaveBeenCalled();
    });
  });
});
