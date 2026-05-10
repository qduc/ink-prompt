This file provides guidance to AI assistants when working with code in this repository.

REMEMBER: This file must be kept up-to-date with every _architecture_ change to the project. It is your job to do it without waiting for user's request.

## Project Overview

`ink-prompt` is a React Ink component library for creating interactive CLI prompts. It provides reusable components that integrate with Ink's terminal rendering system to enable user input in CLI applications.

## Development Philosophy

This project follows **Test-Driven Development (TDD)**:
- Tests must be written first, before implementation code
- Write the minimum code necessary to make tests pass
- Tests should validate behavior, not implementation details
- Tests must survive large refactoring - they should continue passing even when internals change significantly

## Commands

### Build & Development
- `npm run build` - Compile TypeScript to JavaScript (outputs to `dist/`)
- `npm run dev` - Watch mode for development (continuous compilation)
- `npm run type-check` - Run TypeScript type checking without emitting files
- `npm run clean` - Remove build artifacts

### Testing
- `npm test` or `npm run test` - Run all tests once (Vitest)
- `npm run test:watch` - Run tests in watch mode (re-runs on file changes)
- `npm run test:ui` - Launch Vitest UI for interactive test debugging

Test environment uses `happy-dom` for DOM simulation and Vitest globals are enabled.

## Architecture

**Component Structure:**
- `src/components/` - Reusable Ink components
  - Each component lives in its own directory with an `index.tsx` file
  - Components export both the component and their prop types
- `src/index.ts` - Main entry point that re-exports all public APIs

**Hooks:**
- `src/hooks/` - Reusable React hooks for Ink components
  - `useTerminalWidth.ts` - Hook that provides terminal width with resize event handling
    - Returns `propWidth` if provided, otherwise returns terminal width from stdout
    - Automatically updates on terminal resize events with debouncing (default: 100ms)
    - Debounce prevents excessive re-renders during rapid terminal resizing (e.g., when user drags window)
    - Debounce delay is configurable via optional second parameter: `useTerminalWidth(width?, debounceMs?)`
    - Properly cleans up event listeners and pending debounce timers on unmount

**Utilities:**
- `src/utils/logger.ts` - File-based debug logger
  - `log(message)` - Writes timestamped debug messages to a log file
  - `initLogger()` - Clears any existing log file (call once at app start)
  - Log file location: `$INK_PROMPT_LOG_FILE` env var or `./ink-prompt.debug.log`

**Text Wrapping:**
- Word-aware wrapping: Text wraps at word boundaries (spaces) when possible
- Long words that exceed the terminal width are hard-wrapped
- Both rendering (`wrapLines` in TextRenderer) and cursor navigation (`moveCursor` in TextBuffer) use consistent word-aware wrapping logic

**Undo/Redo History Management:**
- `useTextInput` hook maintains undo/redo stacks for text edits
- History is bounded by `historyLimit` option (default: 100 entries) to prevent unbounded memory growth
- When undo stack exceeds the limit, oldest entries are discarded
- Each history entry stores a full snapshot of the buffer, cursor, and placeholder state
- Redo stack is cleared whenever a new edit occurs
- Consecutive single-character inserts are batched into one undo step via `undoDebounceMs` (default: 200ms); set `undoDebounceMs: 0` to disable batching

**Paste Placeholders (`pasteThreshold`):**
- `src/components/MultilineInput/Placeholder.ts` - Utility module for paste placeholder markers
  - When `pasteThreshold` prop is set on MultilineInput, text exceeding this character count (when pasted in a single input event) is replaced with an atomic placeholder marker
  - Placeholders use inline markers in the buffer string: `\x00P{id}\x00` (null-byte-delimited, cannot be typed by user)
  - A separate `PlaceholderState` registry tracks `id → { originalText, displayText }`
  - The internal buffer stores markers; `value` / `onChange` / `onSubmit` return the expanded original text
  - `TextRenderer` expands markers to display text (e.g., `[Paste text #1]`) for visual rendering
  - Placeholders are atomic: backspace/delete remove the entire placeholder, arrow keys skip over them
  - History snapshots include `PlaceholderState`, so undo/redo preserves placeholders
  - `formatPastePlaceholder` prop allows customizing display text format
  - `Placeholder.ts` exports utility functions: `createMarker`, `addPlaceholder`, `removePlaceholder`, `getDisplayLine`, `getValue`, `findPlaceholderAt/Before/After`, `bufferColToDisplayCol`, `displayColToBufferCol`, `getValueCursorOffset`, `getCursorFromValueOffset`

**Build System:**
- TypeScript compiles from `src/` to `dist/`
- Outputs CommonJS modules (`.js`) with type definitions (`.d.ts`)
- ESM import available via `dist/index.mjs` (dual module support)
- Target: ES2020

**Dependencies:**
- Peer dependencies: React 16.8+ and Ink 4.x/5.x/6.x/7.x
- Components must be compatible with Ink versions from 4.x through 7.x
- Maintain compatibility with both Ink 4.x and 7.x (and versions in-between)
- Development uses Vitest for testing with happy-dom for React component testing

## Key Constraints

- This is a library package, not an application - focus on reusable components
- Components must work in terminal environments (Ink limitations apply)
- Maintain compatibility with Ink versions from 4.x through 7.x
