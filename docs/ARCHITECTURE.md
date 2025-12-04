# Module Structure

## 1. **`TextBuffer` (Core Logic)**
```
src/components/MultilineInput/TextBuffer.ts
```
**Responsibilities:**
- Store lines as `string[]`
- Track cursor position `{ line: number, column: number }`
- Pure functions for text operations:
  - `insertChar(buffer, char, cursor)` → new buffer
  - `deleteChar(buffer, cursor)` → new buffer
  - `insertNewLine(buffer, cursor)` → new buffer
  - `moveCursor(buffer, cursor, direction)` → new cursor
  - `getTextContent(buffer)` → string (joins with \n)

**Why separate:**
- Testable without React/Ink
- Reusable logic
- No side effects

## 2. **`useTextInput` (State Hook)**
```
src/components/MultilineInput/useTextInput.ts
```
**Responsibilities:**
- Manage buffer state with `useState`
- Provide actions: `{ insert, delete, newLine, moveCursor, getText, setText }`
- Handle cursor bounds validation
- Optional: undo/redo history

**Why separate:**
- Decouples state management from UI
- Makes the component cleaner
- Could swap out implementation later

## 3. **`KeyHandler` (Input Mapping)**
```
src/components/MultilineInput/KeyHandler.ts
```
**Responsibilities:**
- Map keyboard events to actions
- Define key bindings:
  ```ts
  {
    'ArrowUp': () => moveCursor('up'),
    'ArrowLeft': () => moveCursor('left'),
    'Enter': () => newLine(),
    'Backspace': () => deleteChar(),
    ...
  }
  ```
- Handle special keys vs printable chars

**Why separate:**
- Easy to customize keybindings
- Clear input contract
- Could support vim mode later by swapping this

## 4. **`TextRenderer` (Display Logic)**
```
src/components/MultilineInput/TextRenderer.tsx
```
**Responsibilities:**
- Take buffer + cursor position
- Render lines with Ink components
- Show cursor (maybe as `█` or inverse colors)
- Handle viewport if scrolling needed
- Calculate visible region

**Why separate:**
- UI concerns isolated
- Could support different rendering modes (scrolling vs wrapping)
- Easier to style

## 5. **`MultilineInput` (Main Component)**
```
src/components/MultilineInput/index.tsx
```
**Responsibilities:**
- Wire everything together
- Use `useTextInput` for state
- Use Ink's `useInput` hook
- Pass events to `KeyHandler`
- Pass state to `TextRenderer`
- Expose props: `value`, `onChange`, `onSubmit`, `placeholder`, etc.

**Why separate:**
- Thin orchestration layer
- Easy to understand data flow
- Clean public API

## Optional Modules

## 6. **`utils/textUtils.ts`** (if needed)
- String width calculation (for unicode)
- Text wrapping logic
- Line truncation

## 7. **`types.ts`**
- Shared TypeScript interfaces
- `Buffer`, `Cursor`, `KeyBinding`, etc.

## File Structure
```
src/components/MultilineInput/
├── index.tsx              # Main component (exports default)
├── useTextInput.ts        # State management hook
├── TextBuffer.ts          # Pure text operations
├── KeyHandler.ts          # Keyboard mapping
├── TextRenderer.tsx       # Display component
├── types.ts               # Shared types
└── __tests__/
    ├── TextBuffer.test.ts
    ├── useTextInput.test.ts
    └── integration.test.tsx
```

## Data Flow
```
User Input
    ↓
useInput (Ink)
    ↓
KeyHandler (map key → action)
    ↓
useTextInput (update state)
    ↓
TextRenderer (display)
    ↓
Screen
```

This setup gives you:
- ✅ Testability (each module independently)
- ✅ Reusability (TextBuffer works anywhere)
- ✅ Maintainability (clear responsibilities)
- ✅ Flexibility (swap out KeyHandler for vim mode, etc.)

**Start order:**
1. `TextBuffer` + tests (get logic right)
2. `useTextInput` (wrap in React state)
3. `TextRenderer` (make it visible)
4. `KeyHandler` (wire up inputs)
5. `MultilineInput` (glue it all)
