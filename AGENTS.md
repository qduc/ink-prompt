This file provides guidance to AI assistants when working with code in this repository.

REMEMBER: This file must be kept up-to-date with every _architecture_ change to the project. It is your job to do it without waiting for user's request.

REMEMBER: `README.md` must be kept up-to-date whenever adding a user-facing feature, changing component props, changing exported types, or changing documented behavior.

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

**Unified Block System:**
- `src/components/MultilineInput/BlockTypes.ts` — shared types for both paste placeholder and image blocks
  - `BlockKind`: `'paste' | 'image'`
  - `BlockEntry`: discriminated union (`PasteBlockEntry | ImageBlockEntry`)
  - `BlockState`: single registry with `entries: Map<string, BlockEntry>`, separate counters for paste and image display numbers (both start at 1)

- `src/components/MultilineInput/BlockMarker.ts` — unified marker format for both block kinds
  - Format: `\uE000{kind}:{id}:{displayNumber}\uE001` (PUA delimited, `p:` for paste, `i:` for image)
  - `createBlockMarker(kind, id, displayNumber)` — create a marker string
  - `parseBlockMarkers(text)` — find all markers in a line (replaces both old `MARKER_REGEX` and `parseSentinels`)
  - `findBlockMarkerAt/Before/After` — cursor navigation helpers
  - `removeBlockMarker`, `generateBlockId`, `getBlockPlaceholderText`

- `src/components/MultilineInput/BlockRegistry.ts` — unified registry management
  - `createPasteBlockEntry(state, originalText, displayText)` — create a paste block with its marker
  - `createImageBlockEntry(state, imageRef)` — create an image block with its marker
  - `removeBlock(state, id)` — remove entry from registry
  - `getValue(lines, entries)` — expand paste markers to original text, pass image markers through
  - `getDisplayLine`, `bufferColToDisplayCol`, `displayColToBufferCol`, `getValueCursorOffset`, `getCursorFromValueOffset` — all unified for both block kinds

- `src/components/MultilineInput/AtomicBlocks.ts` — single scanner using `parseBlockMarkers`
  - `findAtomicBlocks(line, entries?)` returns sorted `AtomicBlock[]` with `{ kind: 'paste' | 'image', id, start, end, displayWidth, displayText, dim }`
  - `dim: true` for image blocks (rendered with `dimColor`), `false` for paste blocks
  - `findAtomicBlockBefore/After/Spanning(line, offset, entries?)` for cursor-side queries
  - All consumers (`TextBuffer`, `TextRenderer`, `useTextInput`) use the unified API

**Paste Placeholders (`pasteThreshold`):**
- When `pasteThreshold` prop is set on MultilineInput, text exceeding this character count (when pasted in a single input event) is replaced with a paste block marker using the unified format
- `formatPastePlaceholder` prop customizes display text format, receives 1-based `displayNumber`
- Markers are atomic: backspace/delete remove the entire placeholder, arrow keys skip over them
- `value` / `onChange` / `onSubmit` return the expanded original text

**Image Paste Support:**
- Optional feature controlled by `enableImagePaste` prop (default `false`), backward compatible
- Images use the same unified marker format as paste placeholders (`kind: 'i'`)
- Rendered as `[Pasted Image #N]` text with `dimColor` styling
- Image data stored in the same `BlockState` registry, separate display number counter from paste blocks

**Text Wrapping:**
- Word-aware wrapping: Text wraps at word boundaries (spaces) when possible
- Long words that exceed the terminal width are hard-wrapped
- Both rendering (`wrapLines` in TextRenderer) and cursor navigation (`moveCursor` in TextBuffer) use consistent word-aware wrapping logic
- Block markers (paste placeholders and image placeholders) are atomic — never split across visual rows
- Visual width of a block marker equals its placeholder text length

**Undo/Redo History Management:**
- `useTextInput` hook maintains undo/redo stacks for text edits
- History is bounded by `historyLimit` option (default: 100 entries) to prevent unbounded memory growth
- When undo stack exceeds the limit, oldest entries are discarded
- Each history entry stores a full snapshot of the buffer, cursor, and block state
- Redo stack is cleared whenever a new edit occurs
- Consecutive single-character inserts are batched into one undo step via `undoDebounceMs` (default: 200ms); set `undoDebounceMs: 0` to disable batching

**Clipboard Reader Abstraction:**
- `src/components/MultilineInput/clipboard/` — platform-specific clipboard readers
  - `MacOSClipboardReader` — uses `osascript` to read `«class PNGf»` and plain text
  - `LinuxX11ClipboardReader` — uses `xclip` with image/png and text/plain targets
  - `LinuxWaylandClipboardReader` — uses `wl-paste` with --type flags
  - `WindowsClipboardReader` — uses PowerShell `Get-Clipboard` and `System.Windows.Forms.Clipboard`
  - Factory `createClipboardReader()` detects platform via `process.platform` and `$WAYLAND_DISPLAY`
- `ImageValidator` sniffs magic bytes (PNG, JPEG, WebP, GIF) and enforces size/count/mime limits
- `useClipboardPaste` hook wraps async clipboard reading with 1500ms timeout and error mapping

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
