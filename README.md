<p align="center">
  <img src="build/icon.png" width="128" height="128" alt="Plume icon">
</p>

<h1 align="center">Plume</h1>

<p align="center">
  A friendly Markdown reader and editor for everyone, with a live preview.<br>
  Small, free and open source. macOS, Windows and Linux.
</p>

---

Someone sent you a `.md` file and you don't know what to do with it? Open it with Plume: it shows up
nicely formatted, like a web page. Want to change it? Click **Edit**: a toolbar writes the Markdown
for you, and the preview next to it shows the result as you type.

## Features

- **Read mode** — headings, lists, tables, checklists, quotes, code with syntax highlighting, local
  and web images. Tick the boxes of a checklist directly; links open in your browser.
- **Edit mode** — formatting toolbar (headings, bold, italic, links, images, lists, checklists,
  quotes, code, tables…), familiar shortcuts (⌘/Ctrl + B, I, K), lists that continue when you press
  Enter, spell check, find and replace, and a **live preview** that follows the text as you scroll.
- **Paste from anywhere** — text copied from a web page, Word or Google Docs keeps its formatting
  (converted to Markdown). Pasted screenshots and inserted pictures are copied into an `images`
  folder next to your document, so it can be moved or shared with them.
- **Share** — export as a standalone web page, print or save as PDF.
- **Comfortable** — light and dark themes, adjustable text size, classic or modern reading font,
  autosave if you want it, recent documents, drag and drop, one window per document.
- **Open .md files with Plume** — one click in the settings (offered once at first launch).
- **Languages** — English and French (contributions welcome).
- **Small** — built with [Tauri](https://tauri.app): it uses the system's web engine instead of
  bundling a browser, so the download is a few megabytes. No account, no cloud, no telemetry.

## Download

Get the latest version from the [releases page](https://github.com/croos555/plume/releases):

| System | File |
| ------ | ---- |
| macOS 11+ (Apple Silicon and Intel) | `Plume_x.y.z_universal.dmg` |
| Windows 10 and 11 | `Plume_x.y.z_x64-setup.exe` |
| Linux | `.AppImage`, `.deb` (Debian, Ubuntu) or `.rpm` (Fedora, openSUSE), x64 and arm64 |

Windows 10 needs Microsoft Edge WebView2, which the installer adds when it is missing (it is
already part of Windows 11). On Linux, Plume uses WebKitGTK (`libwebkit2gtk-4.1`), which the `.deb`
and `.rpm` packages install automatically.

## Using Plume

See the [user guide](docs/user-guide.md). In the app, **More → Markdown guide** shows what each
symbol does.

## Building from source

You need [Node.js](https://nodejs.org) 22+ and [Rust](https://rustup.rs) (stable), plus the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) of your system.

```bash
npm install
npm run dev      # run the app with hot reload
npm run dist     # build the installers for this system into src-tauri/target/release/bundle
```

More in [docs/development.md](docs/development.md) and [docs/building.md](docs/building.md).

## Contributing

Bug reports, translations and pull requests are welcome: read [CONTRIBUTING.md](CONTRIBUTING.md).
Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Christophe Roos
