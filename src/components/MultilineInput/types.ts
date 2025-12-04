/**
 * Cursor position in the text buffer
 */
export interface Cursor {
  /** 0-indexed line number */
  line: number;
  /** 0-indexed column position */
  column: number;
}

/**
 * Text buffer containing multiple lines
 */
export interface Buffer {
  /** Array of text lines (without newline characters) */
  lines: string[];
}

/**
 * Cursor movement directions
 */
export type Direction = 'up' | 'down' | 'left' | 'right' | 'lineStart' | 'lineEnd';

/**
 * Result of wrapping buffer lines for visual display
 */
export interface WrapResult {
  /** Visual lines after wrapping */
  visualLines: string[];
  /** Row in visual lines where cursor appears */
  cursorVisualRow: number;
  /** Column in that visual row where cursor appears */
  cursorVisualCol: number;
}
