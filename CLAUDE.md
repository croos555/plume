# Plume — notes for Claude Code

Friendly Markdown reader and editor for non-technical users: read mode (formatted document) and edit
mode (formatting toolbar + live, scroll-synced preview). One window per document. Sibling of Sshelby
and Bucketeer (same conventions) but built with **Tauri 2** instead of Electron to keep installers
small (a few MB): never add a dependency that bundles a browser engine or native addons without need.

Open source (MIT). Code, comments, docs and commit messages are in English. User and contributor
docs live in README.md and docs/; keep them in sync when behavior changes.

## Open source standards (non-negotiable)

Plume is a public MIT project on GitHub (github.com/croos555/plume):

- **History**: small, focused commits with [Conventional Commits](https://www.conventionalcommits.org/)
  messages and a body explaining *why*. Never commit secrets, personal data, local paths or
  machine-specific config. Never rewrite published history or force-push `main` without the
  maintainer's explicit approval.
- **Versioning**: [Semantic Versioning](https://semver.org/); the version in `package.json`,
  `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, `CHANGELOG.md` (Keep a Changelog,
  user-visible changes under *Unreleased*) and the `vX.Y.Z` tag must agree. Releases are cut by
  pushing an annotated tag; CI drafts the GitHub release.
- **Quality gates**: `npm run typecheck`, `npm run build:web`, `cargo fmt --check` and
  `cargo clippy -- -D warnings` (in `src-tauri`) must pass before pushing; CI checks every push and
  pull request. Keep `npm audit --omit=dev` clean and dependencies MIT-compatible.
- **Docs in sync**: README, `docs/`, CHANGELOG and this file are updated in the same commit as the
  behavior they describe.
- **Community files** stay current: LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue and PR
  templates.
- **Security**: documents are untrusted. Rendered HTML stays sanitized (DOMPurify), the CSP strict,
  the asset protocol scope limited to opened documents' folders, and capabilities minimal
  (`docs/security.md`).

## Audience

Users are not technical. Every visible text is plain language, translated (`src/lib/i18n.ts`, en +
fr; the macOS menu in `src-tauri/src/menu.rs`). Prefer sensible defaults over new options.

## Commands

```bash
npm run dev          # tauri dev: Vite on :1420 + the app
npm run typecheck    # tsc --noEmit
npm run build:web    # front-end only, into dist/
npm run dist         # installers for this system (src-tauri/target/release/bundle)
npx tauri build --debug --bundles app   # debug .app: needed to test Finder "open with" on macOS
```

Rust lives in `~/.cargo/bin` (add it to PATH for the Tauri CLI). No test runner yet.

## Layout

See docs/development.md (architecture, windows/files flow, preview sync).

## Rules and gotchas

- The webview's `navigator.language` follows the app bundle's localization, not the user: the system
  locale comes from Rust (`sys_locale`) through `window_ready`.
- A page must register its event listeners before calling `window_ready`, or files opened right
  after launch are lost.
- No React StrictMode: double effects would call `window_ready` twice.
- On macOS the application menu owns the shortcuts (menu accelerators); the JS shortcut handler only
  runs on Windows/Linux, to avoid running commands twice.
- Images added to a document are copied into `images/` next to it; unsaved documents are saved first.
- Windows cannot set default apps programmatically: `default_app.rs` opens the system "Open with"
  dialog there; macOS uses LaunchServices, Linux `xdg-mime`.

## CI

- `ci.yml`: typecheck, web build, fmt, clippy, npm audit on Ubuntu 22.04.
- `build.yml` (tags `v*`, manual): universal macOS dmg (signed + notarized on tags, same secrets as
  Bucketeer: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_API_KEY_BASE64`, `APPLE_API_KEY_ID`,
  `APPLE_API_ISSUER`), Linux x64/arm64 AppImage/deb/rpm, Windows NSIS installer cross-compiled on
  Linux with cargo-xwin and signed with ssign/Certum (`CERTUM_USERNAME`, `CERTUM_TOTP_SECRET`)
  through `build/sign-win.sh`; draft release on tags. See docs/building.md.
