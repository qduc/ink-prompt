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

**Utilities:**
- `src/utils/logger.ts` - File-based debug logger
  - `log(message)` - Writes timestamped debug messages to a log file
  - `initLogger()` - Clears any existing log file (call once at app start)
  - Log file location: `$INK_PROMPT_LOG_FILE` env var or `./ink-prompt.debug.log`

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
