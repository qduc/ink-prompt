import { type Key, type Buffer, type Cursor, type Direction } from './types.js';
import { type UseTextInputResult } from './useTextInput.js';
import { log } from '../../utils/logger.js';

export interface KeyHandlerActions extends Omit<UseTextInputResult, 'value' | 'cursor' | 'cursorOffset' | 'setCursorOffset'> {
  submit: () => void;
}

/**
 * Escape sequences for Home key (various terminal emulators)
 */
const HOME_SEQUENCES = [
  '\x1b[H',   // CSI H (xterm)
  '\x1b[1~',  // CSI 1~ (linux console)
  '\x1bOH',   // SS3 H (xterm application mode)
  '\x1b[7~',  // CSI 7~ (rxvt)
];

/**
 * Escape sequences for End key (various terminal emulators)
 */
const END_SEQUENCES = [
  '\x1b[F',   // CSI F (xterm)
  '\x1b[4~',  // CSI 4~ (linux console)
  '\x1bOF',   // SS3 F (xterm application mode)
  '\x1b[8~',  // CSI 8~ (rxvt)
];

/**
 * Handles keyboard input and maps it to text input actions.
 *
 * @param key - The Ink key object
 * @param input - The input string (if any)
 * @param buffer - The current text buffer
 * @param actions - The actions available to modify the state
 * @param cursor - The current cursor position (optional, but required for some logic like backslash check)
 * @param rawInput - The raw input sequence (optional, used for detecting Home/End keys)
 */
export function handleKey(
  key: Partial<Key>,
  input: string,
  buffer: Buffer,
  actions: KeyHandlerActions,
  cursor?: Cursor,
  rawInput?: string
): void {
  // Navigation
  if (key.upArrow) {
    actions.moveCursor('up');
    return;
  }
  if (key.downArrow) {
    actions.moveCursor('down');
    return;
  }
  if (key.leftArrow) {
    actions.moveCursor('left');
    return;
  }
  if (key.rightArrow) {
    actions.moveCursor('right');
    return;
  }

  // Home/End key detection
  // Ink doesn't expose key.home/key.end, so we check:
  // 1. Raw escape sequences if available
  // 2. Ctrl+A (home) and Ctrl+E (end) - common terminal shortcuts
  if (rawInput && HOME_SEQUENCES.includes(rawInput)) {
    actions.moveCursor('lineStart');
    return;
  }
  if (rawInput && END_SEQUENCES.includes(rawInput)) {
    actions.moveCursor('lineEnd');
    return;
  }
  // Ctrl+A for line start (common in bash/readline)
  if (key.ctrl && input === 'a') {
    actions.moveCursor('lineStart');
    return;
  }
  // Ctrl+E for line end (common in bash/readline)
  if (key.ctrl && input === 'e') {
    actions.moveCursor('lineEnd');
    return;
  }

  // History
  if (key.ctrl) {
    if (input === 'z') {
      actions.undo();
      return;
    }
    if (input === 'y') {
      actions.redo();
      return;
    }
    if (input === 'j') {
      actions.newLine();
      return;
    }
  }

  // Editing
  if (key.backspace) {
    actions.delete();
    return;
  }
  if (key.delete) {
    // Delete key - forward delete (delete character after cursor)
    actions.deleteForward();
    return;
  }

  // Submission / New Line
  if (key.return) {
    log(`[KEYHANDLER] return key, cursor=${JSON.stringify(cursor)}, currentLine="${(cursor ? buffer.lines[cursor.line || 0] : 'no cursor').replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" endsWithBackslash=${cursor ? buffer.lines[cursor.line || 0].endsWith('\\') : false}`);
    if (cursor) {
      const currentLine = buffer.lines[cursor.line];      // Check if line ends with backslash AND cursor is at the end (or we just check the line content?)
      // Requirement: "Line ending with \ + Enter continues to next line"
      // Usually this implies the user typed '\' then Enter.
      // We should probably check if the character *before* the cursor is '\' if we want to be precise,
      // or just if the line ends with '\'.
      // Let's assume "line ends with \" means the last char of the line is '\'.

      if (currentLine.endsWith('\\')) {
        // Use combined action to ensure both operations happen with correct state
        actions.deleteAndNewLine();
        return;
      }
    }

    log(`[KEYHANDLER] submit value lines=${buffer.lines.length} lastLine="${buffer.lines[buffer.lines.length-1]?.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}"`);
    actions.submit();
    return;
  }

  // Text Insertion
  // Ignore control keys if they don't have a specific handler above
  if (key.ctrl || key.meta) {
    return;
  }

  if (input) {
    log(`[KEYHANDLER] insert input="${input.replace(/[\x00-\x1F\x7F-\uFFFF]/g, c => `\\x${c.charCodeAt(0).toString(16)}`)}" len=${input.length} cursor=${JSON.stringify(cursor || {})} bufferLines=${buffer.lines.length}`);
    actions.insert(input);
  }
}
