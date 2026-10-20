# Development

## Setup

- [Node.js](https://nodejs.org) 22+, [Rust](https://rustup.rs) stable.
- The [Tauri prerequisites](https://tauri.app/start/prerequisites/) of your system (Xcode command line
  tools on macOS; WebView2 and the MSVC build tools on Windows; `libwebkit2gtk-4.1-dev`,
  `librsvg2-dev` and friends on Linux).

```bash
npm install
npm run dev          # Vite dev server + the app, hot reload for the UI, restart on Rust changes
npm run typecheck    # TypeScript
npm run build:web    # front-end bundle only (dist/)
cd src-tauri && cargo fmt && cargo clippy -- -D warnings
npm run dist         # installers for this system (src-tauri/target/release/bundle)
```

`npm run dev` runs the bare binary, which macOS does not treat as an app (no bundle id, no file
associations, `RunEvent::Opened` never fires). To test opening files from Finder, build a debug
bundle: `npx tauri build --debug --bundles app` then `open -a src-tauri/target/debug/bundle/macos/Plume.app file.md`.

## Architecture

```
src/                     front-end (React 19 + TypeScript, Vite)
  App.tsx                window state: document, modes, commands, dialogs, drag and drop, close guard
  editor/                CodeMirror 6: setup.ts (extensions, Markdown styling, keymap),
                         commands.ts (toolbar actions), Editor.tsx (React wrapper)
  components/            TopBar, Toolbar, Preview, Welcome, dialogs
  lib/markdown.ts        markdown-it + task lists + highlight.js, sanitized with DOMPurify;
                         adds data-line (scroll sync) and heading ids; resolves local images
  lib/paste.ts           HTML → Markdown (turndown + GFM) for pasting
  lib/i18n.ts            UI strings (en, fr)
  lib/settings.ts        preferences in localStorage, shared by every window
  styles/markdown.css    rendered document; also embedded in exported web pages
src-tauri/               back-end (Rust, Tauri 2)
  src/lib.rs             commands (read/write files, images, windows, print), window creation,
                         files opened by the system, single instance, quit flow
  src/menu.rs            macOS application menu (en, fr)
  src/default_app.rs     "Open .md files with Plume" per platform
  tauri.conf.json        bundle, file associations, CSP, asset protocol
  capabilities/          permissions of the document windows
build/                   icon.svg (source), icon.png, sign-win.sh (Windows signing hook)
```

### Windows and files

Every window is a document window (`doc-N`) created by `create_window`. A window's page calls
`window_ready` once its listeners are registered; that returns the files and the menu action meant
for it. Files opened later (Finder, Explorer through the single-instance plugin, the command line)
go to the focused window as an `open-files` event: an empty window opens the first one itself,
otherwise the page asks for a new window.

macOS keeps the app running without windows; the custom *Quit* item asks every window to close
(each asks about unsaved changes) and the app exits once they are gone.

### Preview

`renderMarkdown` runs on every change (deferred with `useDeferredValue`). Block tokens carry their
source line in `data-line`; the editor's scroll position is mapped to those elements to keep the
preview aligned. Clicking a task checkbox edits the matching line through the editor, so it can be
undone.

### Conventions

- User-facing text goes through `i18n.ts`, in every language. The macOS menu has its own strings in
  `menu.rs`.
- The renderer only reaches the system through the Tauri commands listed in `lib.rs` and the
  permissions in `capabilities/default.json`; keep both minimal.
- Keep dependencies small: the installers are a few megabytes and that is a feature.
