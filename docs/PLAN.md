# MultilineInput Component Plan

## Core Problems to Solve

### 1. **State Management**
- Store text as multiple lines (array of strings)
- Track cursor position (which line, which column)
- Handle text insertion/deletion at cursor position
- Maintain state consistency when text changes

### 2. **Visual Rendering**
- Display multiple lines of text
- Show cursor at correct position
- Handle text that exceeds terminal width (wrapping or scrolling?)
- Keep cursor visible (viewport management if scrolling)

### 3. **Keyboard Input Handling**
- **Text insertion**: Regular characters
- **Navigation**:
  - Arrow keys (up/down/left/right)
  - Home/End (start/end of line)
  - Maybe Ctrl+Home/End (start/end of document)
- **Editing**:
  - Enter (new line)
  - Backspace (delete before cursor)
  - Delete (delete at cursor)
- **Submit**: Some key combo to actually send the input (like Ctrl+D or Ctrl+Enter)

### 4. **Edge Cases**
- Empty input
- Cursor at start/end of lines
- Moving up/down when lines have different lengths
- Deleting across line boundaries (backspace at start of line should merge with previous)
- Unicode/emoji width (do you care about this?)

## Questions for Planning

**1. Visual behavior:**
   - Do you want word wrapping or horizontal scrolling? Word wrapping
   - Fixed height or grow with content? Grow with content
   - Do you need to show line numbers? No

**2. Feature scope:**
   - Do you need selection/copy-paste? No
   - Undo/redo? Yes (simple history stack - save state on each edit, Ctrl+Z to undo, Ctrl+Y to redo)

**3. Submit behavior:**
   - What key sends the input? (Ctrl+Enter? Ctrl+D? Just Enter?) Enter
   - Can users have newlines in their input? Yes, by:
     - Ctrl+J inserts a newline
     - Line ending with `\` + Enter continues to next line (removes the `\` and inserts newline)

**4. Integration:**
   - Is this a standalone component or part of a larger form? Standalone
   - Do you need to validate input before accepting? No
