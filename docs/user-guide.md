# User guide

## Opening documents

- Double-click a `.md` file (once Plume opens Markdown files, see below), drop it onto a Plume
  window, or use **Open a document…** (⌘O / Ctrl+O).
- Each document opens in its own window. The welcome screen lists your recent documents; the
  small cross next to one removes it from the list (the file itself is not touched).
- Documents open in **Read** mode. Settings → *Open documents ready to edit* changes that.

## Reading

The document is shown formatted. You can:

- tick and untick the boxes of a checklist (the change is written in the document, save it to keep it);
- click links: web links open in your browser, links to sections jump inside the document, links to
  other `.md` files open them in a new window.

## Editing

Click **Edit** (⌘2 / Ctrl+2; **Read** is ⌘1 / Ctrl+1). The text is on the left, the preview on the
right; the preview follows the text when you scroll. Hide it with the button at the top right
(⌘⇧P / Ctrl+Shift+P) to have more room; it also hides itself in narrow windows.

The toolbar writes Markdown for you:

| Button | Shortcut | Result |
| ------ | -------- | ------ |
| Heading menu | | Title, heading, subheading or normal text for the current line |
| **B** | ⌘B / Ctrl+B | Bold |
| *I* | ⌘I / Ctrl+I | Italic |
| S̶ | ⌘⇧X / Ctrl+Shift+X | Strikethrough |
| Link | ⌘K / Ctrl+K | Link (select the text first to turn it into a link) |
| Image | | Picture from the computer or from the web |
| Lists | | Bulleted, numbered or checklist; click again to remove |
| Quote, code, table, divider | | The corresponding block |

Other useful keys: Enter continues a list, Tab and Shift+Tab indent, ⌘F / Ctrl+F finds and replaces,
⌘Z / Ctrl+Z undoes.

### Pictures

Pictures inserted from the computer, dropped onto the editor or pasted (screenshots) are copied into
an `images` folder next to your document, and the document links to them with a relative path. Move
or share the document **with** that folder. A new document is saved first so Plume knows where to
put them.

### Pasting

Text copied from a web page, Word or Google Docs keeps its headings, bold, lists, links and tables:
Plume converts it to Markdown. Hold Shift while pasting to paste plain text, or turn the feature off
in the settings.

## Saving

**Save** (⌘S / Ctrl+S) writes the document; **Save as…** (⌘⇧S / Ctrl+Shift+S) chooses a new name or
place. Under the document name, the top bar says *Saved* or *Not saved*. Closing a window with
unsaved changes asks what to do. With Settings → *Save automatically*, a document that already has a
name is saved a moment after you stop typing.

Plume writes a temporary file and then replaces the document, so a crash never leaves a
half-written file.

## Sharing

- **More → Export as web page…** creates a single `.html` file anyone can open in a browser. Pictures
  stay linked with the same relative paths: keep the `images` folder next to the exported page.
- **More → Print or save as PDF…** (⌘P / Ctrl+P) prints the reading view. To get a PDF, choose
  *Save as PDF* in the print dialog (macOS: the PDF button; Windows: the *Microsoft Print to PDF* printer).

## Settings

**More → Settings** (⌘, / Ctrl+,): theme (system, light, dark), language, text size, reading font
(classic serif or modern sans serif), open in edit mode, autosave, spell check, smart paste, and
**Open .md files with Plume**:

- macOS and Linux: one click makes Plume the default app for Markdown files.
- Windows: apps are not allowed to change this themselves, so Windows shows its *How do you want to
  open this file?* window: choose Plume and tick *Always use this app*.

Plume asks this once at first launch; the settings let you do it later.
