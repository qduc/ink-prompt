import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKey, KeyHandlerActions } from '../KeyHandler.js';
import { Buffer, Key } from '../types.js';

describe('KeyHandler', () => {
  let actions: KeyHandlerActions;
  let buffer: Buffer;

  beforeEach(() => {
    actions = {
      insert: vi.fn(),
      delete: vi.fn(),
      deleteForward: vi.fn(),
      newLine: vi.fn(),
      deleteAndNewLine: vi.fn(),
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

    it('handles Home key via escape sequence', () => {
      // Home key comes as escape sequence, not key.home
      handleKey({}, '', buffer, actions, undefined, '\x1b[H');
      expect(actions.moveCursor).toHaveBeenCalledWith('lineStart');
    });

    it('handles Home key via alternative escape sequence', () => {
      handleKey({}, '', buffer, actions, undefined, '\x1bOH');
      expect(actions.moveCursor).toHaveBeenCalledWith('lineStart');
    });

    it('handles Ctrl+A as Home alternative', () => {
      handleKey({ ctrl: true }, 'a', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('lineStart');
    });

    it('handles End key via escape sequence', () => {
      // End key comes as escape sequence, not key.end
      handleKey({}, '', buffer, actions, undefined, '\x1b[F');
      expect(actions.moveCursor).toHaveBeenCalledWith('lineEnd');
    });

    it('handles End key via alternative escape sequence', () => {
      handleKey({}, '', buffer, actions, undefined, '\x1bOF');
      expect(actions.moveCursor).toHaveBeenCalledWith('lineEnd');
    });

    it('handles Ctrl+E as End alternative', () => {
      handleKey({ ctrl: true }, 'e', buffer, actions);
      expect(actions.moveCursor).toHaveBeenCalledWith('lineEnd');
    });
  });

  describe('Editing', () => {
    it('handles Backspace', () => {
      handleKey({ backspace: true }, 'backspace', buffer, actions);
      expect(actions.delete).toHaveBeenCalled();
    });

    it('handles Delete (forward delete)', () => {
      handleKey({ delete: true }, '', buffer, actions);
      expect(actions.deleteForward).toHaveBeenCalled();
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

      // It should use the combined deleteAndNewLine action
      expect(actions.deleteAndNewLine).toHaveBeenCalledTimes(1);
      expect(actions.delete).not.toHaveBeenCalled();
      expect(actions.newLine).not.toHaveBeenCalled();
      expect(actions.submit).not.toHaveBeenCalled();
    });

    it('handles Enter as newline if line ends with backslash (multiple lines)', () => {
        const cursor = { line: 1, column: 7 };
        buffer = { lines: ['first', 'second\\'] };

        handleKey({ return: true }, 'return', buffer, actions, cursor);

        expect(actions.deleteAndNewLine).toHaveBeenCalledTimes(1);
        expect(actions.delete).not.toHaveBeenCalled();
        expect(actions.newLine).not.toHaveBeenCalled();
        expect(actions.submit).not.toHaveBeenCalled();
    });
  });
});
