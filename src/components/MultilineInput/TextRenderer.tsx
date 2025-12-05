import React from 'react';
import { Box, Text } from 'ink';
import type { Buffer, Cursor, WrapResult } from './types.js';
import { useTerminalWidth } from '../../hooks/useTerminalWidth.js';

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

  // Ensure width is at least 1 to avoid infinite loops
  const safeWidth = Math.max(1, width);

  let visualRowIndex = 0;

  for (let lineIndex = 0; lineIndex < buffer.lines.length; lineIndex++) {
    const line = buffer.lines[lineIndex];
    const isCursorLine = lineIndex === cursor.line;

    // Handle empty line case
    if (line.length === 0) {
      visualLines.push('');
      if (isCursorLine) {
        cursorVisualRow = visualRowIndex;
        cursorVisualCol = 0;
      }
      visualRowIndex++;
      continue;
    }

    let remaining = line;
    let offset = 0;

    while (remaining.length > 0) {
      let chunkLength = safeWidth;

      if (remaining.length <= safeWidth) {
        chunkLength = remaining.length;
      } else {
        // Find split point (last space within width)
        let splitIndex = -1;
        for (let i = safeWidth - 1; i >= 0; i--) {
          if (remaining[i] === ' ') {
            splitIndex = i;
            break;
          }
        }

        if (splitIndex !== -1) {
          // Include the space in the chunk
          chunkLength = splitIndex + 1;
        }
      }

      const chunk = remaining.slice(0, chunkLength);
      visualLines.push(chunk);

      if (isCursorLine) {
      // Check if cursor falls within this chunk
        // Cursor is at `cursor.column` (relative to line start)
        // Current chunk covers `offset` to `offset + chunkLength`
        if (cursor.column >= offset && cursor.column < offset + chunkLength) {
          cursorVisualRow = visualRowIndex;
          cursorVisualCol = cursor.column - offset;
        } else if (cursor.column === offset + chunkLength) {
          // Cursor is at the end of this chunk
          if (offset + chunkLength === line.length) {
          // End of line
            cursorVisualRow = visualRowIndex;
            cursorVisualCol = chunkLength;
          } else {
            // Wrap point - cursor should be at start of next line
            // We'll let the next iteration handle it (it will be index 0 of next chunk)
            // But wait, if we are at the wrap point, the next iteration will see:
            // offset = oldOffset + chunkLength.
            // cursor.column == offset.
            // So it enters the first `if` block: cursor.column >= offset.
            // cursorVisualCol = cursor.column - offset = 0.
            // This is correct.
          }
        }
      }

      remaining = remaining.slice(chunkLength);
      offset += chunkLength;
      visualRowIndex++;
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
): React.ReactNode {
  if (!showCursor) {
    // Empty lines need a space to be rendered by Ink
    return <Text>{line || ' '}</Text>;
  }

  // For empty lines with cursor, we need special handling
  if (line.length === 0) {
    return <Text inverse> </Text>;
  }

  const before = line.slice(0, cursorCol);
  const charUnderCursor = cursorCol < line.length ? line[cursorCol] : ' ';
  const after = line.slice(cursorCol + 1);

  // Render the cursor using Ink's Text with inverse colors for high visibility.
  // We show the actual character under the cursor (or a space at line end)
  // with inverted colors to make it stand out in any terminal color scheme.
  return (
    <>
      <Text>{before}</Text>
      <Text inverse>{charUnderCursor}</Text>
      <Text>{after}</Text>
    </>
  );
}

/**
 * TextRenderer component for displaying buffer content with cursor
 */
export function TextRenderer({
  buffer,
  cursor,
  width: propWidth,
  showCursor = true,
}: TextRendererProps): React.ReactElement {
  const width = useTerminalWidth(propWidth);
  const { visualLines, cursorVisualRow, cursorVisualCol } = wrapLines(buffer, cursor, width);

  return (
    <Box flexDirection="column">
      {visualLines.map((line, index) => {
        const isCursorRow = index === cursorVisualRow;

        return (
          <Box key={index}>
            {isCursorRow ? (
              // renderLineWithCursor returns a ReactNode composed of Text
              renderLineWithCursor(line, cursorVisualCol, showCursor)
            ) : (
              <Text>{line || ' '}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
