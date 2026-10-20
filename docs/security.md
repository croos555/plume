# Security

Plume opens documents from anywhere, so a document must never be able to do more than be displayed.

- **No scripts from documents.** The rendered HTML is sanitized with DOMPurify (scripts, event
  handlers, forms, styles and iframes removed). The Content Security Policy only allows the app's
  own scripts.
- **Minimal permissions.** The page can only call Plume's own commands (read and write a document,
  copy an image next to it, open a window, print) and the dialog and "open URL" plugins. There is no
  general file system or shell access from the page.
- **Images.** Local images are served through Tauri's asset protocol, whose scope starts empty: each
  opened or saved document grants read access to its own folder (and subfolders) for display only.
- **Links** open in the default browser (`http`, `https`, `mailto`, `tel`) or as another Plume
  window (`.md` files); nothing is navigated inside the app.
- **Safe saving.** Documents are written to a temporary file and then renamed over the original.
- **Privacy.** No account, no network access of its own (only web images written in the document are
  loaded), no telemetry. Preferences and recent documents are stored locally in the app's web storage.
