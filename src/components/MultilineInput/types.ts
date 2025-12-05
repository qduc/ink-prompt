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
 * Boundary arrow directions (subset of Direction used for boundary detection)
 */
export type BoundaryDirection = 'up' | 'down' | 'left' | 'right';

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

/**
 * Keyboard key state (mirrors Ink's Key interface)
 * Defined locally to avoid ESM/CJS import issues with Ink
 */
export interface Key {
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  pageDown?: boolean;
  pageUp?: boolean;
  return?: boolean;
  escape?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  tab?: boolean;
  backspace?: boolean;
  delete?: boolean;
  meta?: boolean;
  /** Home key (may not be available in all terminals) */
  home?: boolean;
  /** End key (may not be available in all terminals) */
  end?: boolean;
}
