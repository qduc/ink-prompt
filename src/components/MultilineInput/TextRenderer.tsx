import React from 'react';
import { Text } from 'ink';
import type { Buffer, Cursor, WrapResult } from './types.js';

/**
 * Props for the TextRenderer component
 */
export interface TextRendererProps {
  /** Text buffer to render */
  buffer: Buffer;
  /** Current cursor position */
  cursor: Cursor;
  /** Terminal width for word wrapping (defaults to 80) */
  width?: number;
  /** Whether to show the cursor (defaults to true) */
  showCursor?: boolean;
}

/**
 * Wrap buffer lines to fit within a given width.
 * Returns visual lines and maps cursor position to visual coordinates.
 */
export function wrapLines(buffer: Buffer, cursor: Cursor, width: number): WrapResult {
  const visualLines: string[] = [];
  let cursorVisualRow = 0;
  let cursorVisualCol = 0;

  let visualRowIndex = 0;

  for (let lineIndex = 0; lineIndex < buffer.lines.length; lineIndex++) {
    const line = buffer.lines[lineIndex];
    const isCursorLine = lineIndex === cursor.line;

    if (line.length <= width) {
      // Line fits, no wrapping needed
      visualLines.push(line);

      if (isCursorLine) {
        cursorVisualRow = visualRowIndex;
        cursorVisualCol = cursor.column;
      }

      visualRowIndex++;
    } else {
      // Line needs to be wrapped
      let offset = 0;
      while (offset < line.length) {
        const chunk = line.slice(offset, offset + width);
        visualLines.push(chunk);

        if (isCursorLine) {
          // Check if cursor falls within this chunk
          if (cursor.column >= offset && cursor.column < offset + width) {
            cursorVisualRow = visualRowIndex;
            cursorVisualCol = cursor.column - offset;
          } else if (cursor.column === line.length && offset + chunk.length === line.length) {
            // Cursor at end of line
            cursorVisualRow = visualRowIndex;
            cursorVisualCol = chunk.length;
          }
        }

        offset += width;
        visualRowIndex++;
      }
    }
  }

  return { visualLines, cursorVisualRow, cursorVisualCol };
}

/**
 * Render a line with cursor inserted at the specified position
 */
function renderLineWithCursor(
  line: string,
  cursorCol: number,
  showCursor: boolean
): string {
  if (!showCursor) {
    return line;
  }

  const cursorChar = '█';
  const before = line.slice(0, cursorCol);
  const after = line.slice(cursorCol);

  return before + cursorChar + after;
}

/**
 * TextRenderer component for displaying buffer content with cursor
 */
export function TextRenderer({
  buffer,
  cursor,
  width = 80,
  showCursor = true,
}: TextRendererProps): React.ReactElement {
  const { visualLines, cursorVisualRow, cursorVisualCol } = wrapLines(buffer, cursor, width);

  return (
    <div>
      {visualLines.map((line, index) => {
        const isCursorRow = index === cursorVisualRow;
        const displayLine = isCursorRow
          ? renderLineWithCursor(line, cursorVisualCol, showCursor)
          : line;

        return (
          <div key={index}>
              <Text>{displayLine}</Text>
          </div>
        );
      })}
    </div>
  );
}
