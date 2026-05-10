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

**Text Wrapping:**
- Word-aware wrapping: Text wraps at word boundaries (spaces) when possible
- Long words that exceed the terminal width are hard-wrapped
- Both rendering (`wrapLines` in TextRenderer) and cursor navigation (`moveCursor` in TextBuffer) use consistent word-aware wrapping logic
- Sentinel blocks (image placeholders) are atomic — never split across visual rows
- Visual width of a sentinel block equals its placeholder text length (`[Pasted Image #N]`)

**Undo/Redo History Management:**
- `useTextInput` hook maintains undo/redo stacks for text edits
- History is bounded by `historyLimit` option (default: 100 entries) to prevent unbounded memory growth
- When undo stack exceeds the limit, oldest entries are discarded
- Each history entry stores a full snapshot of the buffer, cursor, and images state
- Redo stack is cleared whenever a new edit occurs
- Consecutive single-character inserts are batched into one undo step via `undoDebounceMs` (default: 200ms); set `undoDebounceMs: 0` to disable batching

**Image Paste Support:**
- Optional feature controlled by `enableImagePaste` prop (default `false`), backward compatible
- Images are represented by sentinel placeholders in the text buffer: `\uE000{id}:{displayNumber}\uE001`
- Sentinels are atomic units — cursor jumps over them, delete/backspace removes the whole block
- Rendered as `[Pasted Image #N]` text with `dimColor` styling
- Visual width of a sentinel equals its placeholder text length for correct wrapping

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
- Peer dependencies: React 16.8+ and Ink 4.x/5.x
- Components must be compatible with both major Ink versions
- Development uses Vitest for testing with happy-dom for React component testing

## Key Constraints

- This is a library package, not an application - focus on reusable components
- Components must work in terminal environments (Ink limitations apply)
- Maintain compatibility with both Ink 4.x and 5.x
