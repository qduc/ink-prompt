# MultilineInput Component Architecture

## Overview

`MultilineInput` is a React Ink component for interactive multiline text input in CLI applications. It follows a modular architecture with clear separation of concerns: state management, text operations, input handling, and rendering.

## Module Structure

### 1. **`TextBuffer.ts` (Core Text Logic)**

**Location:** `src/components/MultilineInput/TextBuffer.ts`

**Responsibilities:**
- Store text as an array of strings (lines array)
- Provide pure functions for text manipulation:
  - `createBuffer(text?)` - Create a buffer from optional initial text
  - `insertText(buffer, cursor, text)` - Insert text at cursor (handles multi-line text)
  - `deleteChar(buffer, cursor)` - Delete before cursor (backspace)
  - `deleteCharForward(buffer, cursor)` - Delete after cursor (Delete key)
  - `insertNewLine(buffer, cursor)` - Split line at cursor
  - `moveCursor(buffer, cursor, direction, width?)` - Move cursor with bounds checking
  - `getTextContent(buffer)` - Get full text as string

**Design Notes:**
- All functions are pure (no side effects)
- All functions return `{ buffer, cursor }` tuples for modified operations
- `moveCursor` supports both logical (buffer line) and visual (wrapped line) navigation
  - When `width` is provided, up/down arrows respect word wrapping
  - When `width` is undefined, up/down arrows move between buffer lines only
- `insertText` handles multi-line insertions by normalizing line endings (\r\n → \n)
- Testable without React or Ink dependencies

### 2. **`useTextInput.ts` (State Management Hook)**

**Location:** `src/components/MultilineInput/useTextInput.ts`

**Responsibilities:**
- Manage buffer state with React `useState`
- Provide action methods that trigger state updates
- Implement undo/redo history:
  - `undoStack` stores past states
  - `redoStack` stores states that were undone
  - Most edit actions push current state to `undoStack` and clear `redoStack`
  - Consecutive single-character inserts are batched into one undo step via `undoDebounceMs` (default: 200ms); set `undoDebounceMs: 0` to disable batching
  - Undo pops from `undoStack` and pushes to `redoStack`
  - Redo pops from `redoStack` and pushes back to `undoStack`
- Handle cursor bounds validation

**Exported Interface (`UseTextInputResult`):**
```ts
{
  value: string;                           // Current text content
  cursor: Cursor;                          // Current cursor position
  insert: (char: string) => void;          // Insert text
  delete: () => void;                      // Delete before cursor
  deleteForward: () => void;               // Delete after cursor
  newLine: () => void;                     // Insert newline
  deleteAndNewLine: () => void;            // Delete char then newline (for backslash continuation)
  moveCursor: (direction: Direction) => void;  // Move cursor
  undo: () => void;                        // Undo last edit
  redo: () => void;                        // Redo last undone edit
  setText: (text: string) => void;         // Replace all text
}
```

**Design Notes:**
- Decouples state management from Ink/rendering concerns
- All history operations use tuple destructuring for immutability
- Terminal width is passed via props for visual-aware cursor navigation
- Line ending normalization happens during insertion

### 3. **`KeyHandler.ts` (Input Mapping)**

**Location:** `src/components/MultilineInput/KeyHandler.ts`

**Responsibilities:**
- Map keyboard input to text actions
- Implement key bindings:
  - **Navigation:** Arrow keys (up/down/left/right), Home/End, Ctrl+A/E
  - **Editing:** Backspace, Delete, Enter, Ctrl+J (newline)
  - **History:** Ctrl+Z (undo), Ctrl+Y (redo)
  - **Submission:** Enter (or Delete+NewLine for backslash continuation)
- Handle Home/End key detection:
  - Checks multiple escape sequences for terminal portability
  - Falls back to Ctrl+A (Home) and Ctrl+E (End) if raw sequences unavailable
  - Requires raw stdin data for reliable detection

**Backslash Continuation Logic:**
- If current line ends with `\` and user presses Enter:
  - Delete the backslash
  - Insert newline (continues text on next line)
  - Otherwise: submit input

**Design Notes:**
- Key handler is pure (takes state, returns nothing, calls actions)
- Actions pattern allows dependency injection for testing
- Ink's `useInput` hook provides high-level key info, but Home/End require raw stdin monitoring
- Escape sequence detection supports multiple terminal emulators (xterm, linux, rxvt)

### 4. **`TextRenderer.tsx` (Display Component)**

**Location:** `src/components/MultilineInput/TextRenderer.tsx`

**Responsibilities:**
- Render buffer content with cursor position
- Handle word wrapping via `wrapLines` function:
  - Splits lines exceeding terminal width
  - Maps cursor position from logical (buffer) to visual (wrapped) coordinates
  - Returns `{ visualLines, cursorVisualRow, cursorVisualCol }`
- Render cursor with inverse colors for visibility
- Show empty line placeholder (space character) for proper Ink rendering

**Exported Components:**
- `TextRenderer` - React component that renders the buffer
- `wrapLines` - Pure function for word wrapping logic

**Design Notes:**
- Word wrapping is visual only (doesn't modify buffer)
- Cursor is rendered with `<Text inverse>` for terminal-agnostic visibility
- Empty lines get a space character to ensure they display in Ink
- Wrapping respects cursor position for accurate display in wrapped content

### 5. **`MultilineInput.tsx` (Main Component)**

**Location:** `src/components/MultilineInput/index.tsx`

**Responsibilities:**
- Orchestrate all submodules into a complete component
- Provide two component exports:
  - `MultilineInputCore` - Core rendering without Ink hooks (testable)
  - `MultilineInput` - Full component with Ink integration
- Manage Ink hooks:
  - `useInput` - Capture keyboard events
  - `useStdout` - Get terminal width
  - `useStdin` - Monitor raw input for Home/End detection
- Sync external value prop to internal state
- Clear input after submission

**Props Interface (`MultilineInputProps`):**
```ts
{
  value?: string;                  // Controlled text value
  onChange?: (value: string) => void;  // Text change callback
  onSubmit?: (value: string) => void;  // Submission callback
  placeholder?: string;            // Placeholder text when empty
  showCursor?: boolean;            // Whether to display cursor (default: true)
  width?: number;                  // Terminal width override
  isActive?: boolean;              // Whether to process input (default: true)
}
```

**Design Notes:**
- `MultilineInputCore` enables testing rendering logic without Ink runtime
- Two-component pattern allows flexible testing:
  - Unit test core with mocked props
  - Integration test full component in Ink context
- Raw stdin monitoring is necessary for Home/End key detection
- Placeholder only displays when input is empty, cursor is hidden, and placeholder is provided
- Input is cleared after submission (idempotent onSubmit)

### 6. **`types.ts` (Shared Types)**

**Location:** `src/components/MultilineInput/types.ts`

**Exports:**
- `Cursor` - Position in buffer (line, column)
- `Buffer` - Text storage (array of lines)
- `Direction` - Movement directions
- `WrapResult` - Word wrapping output
- `Key` - Keyboard state (local copy to avoid ESM/CJS issues)

## Data Flow

```
User Input
    ↓
Ink useInput Hook
    ↓
MultilineInput (component)
    ↓
KeyHandler (map input → action)
    ↓
useTextInput (execute action, update state)
    ↓
TextBuffer (pure text operation)
    ↓
State Updated
    ↓
TextRenderer (wrap lines, render)
    ↓
Screen Output
```

## State Management Pattern

1. **Edit Action Triggered** (e.g., user types 'a')
   - `useTextInput.insert('a')` called
   - Current state is saved for undo (debounced single-character inserts may be batched into one undo step)
   - `TextBuffer.insertText()` computed new buffer
   - State updated

2. **Undo Triggered** (user presses Ctrl+Z)
   - If `undoStack` not empty:
     - Pop previous state from `undoStack`
     - Push current state to `redoStack`
     - Update to previous state

3. **Redo Triggered** (user presses Ctrl+Y)
   - If `redoStack` not empty:
     - Pop next state from `redoStack`
     - Push current state to `undoStack`
     - Update to next state

## Compatibility

**React:** 16.8+ (requires hooks)

**Ink:** 4.x and 5.x compatible
- No breaking API changes between versions used
- Uses stable hooks: `useInput`, `useStdout`, `useStdin`

**Terminal Compatibility:**
- Word wrapping tested with common widths
- Home/End detection supports:
  - xterm (CSI H/F, SS3 H/F)
  - Linux console (CSI 1~/4~)
  - rxvt (CSI 7~/8~)
- Fallback to Ctrl+A/E for unsupported terminals

## Testing Strategy

Tests follow TDD principles and are organized by module:

- `TextBuffer.test.ts` - Pure text operations (no dependencies)
- `useTextInput.test.ts` - State management and history
- `KeyHandler.test.ts` - Input mapping logic
- `TextRenderer.test.tsx` - Rendering and wrapping
- `integration.test.tsx` - Full component behavior

Tests validate behavior (what component does) not implementation details (how it does it). This allows safe refactoring.

## File Structure

```
src/components/MultilineInput/
├── index.tsx                 # Main component (MultilineInput, MultilineInputCore)
├── useTextInput.ts          # State management hook
├── TextBuffer.ts            # Pure text operations
├── KeyHandler.ts            # Keyboard input mapping
├── TextRenderer.tsx         # Display and word wrapping
├── types.ts                 # Shared TypeScript types
└── __tests__/
    ├── TextBuffer.test.ts
    ├── useTextInput.test.ts
    ├── KeyHandler.test.ts
    ├── TextRenderer.test.tsx
    └── integration.test.tsx
```

## Key Design Decisions

1. **Separate TextBuffer:** Pure functions enable testability and reusability without React
2. **Two Components:** `MultilineInputCore` + `MultilineInput` enables testing rendering independently
3. **Visual-aware Cursor:** Up/down navigation respects word wrapping when terminal width provided
4. **Raw stdin Monitoring:** Required for Home/End detection since Ink's high-level API doesn't expose these
5. **History as Stacks:** Simple, efficient undo/redo without complex algorithms
6. **Line Array Storage:** Direct storage prevents joining/splitting strings repeatedly
7. **Escape Sequence Detection:** Multiple formats ensure wide terminal support
