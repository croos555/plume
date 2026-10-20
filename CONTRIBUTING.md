# Contributing

Thanks for your interest in Plume!

Please read and follow the [code of conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and ideas

Open an issue on [GitHub](https://github.com/croos555/plume/issues) with your OS, the Plume
version and the steps to reproduce. A small sample document helps a lot.

Security issues: see [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Translations

UI strings live in `src/lib/i18n.ts` (English is the reference) and the macOS menu in
`src-tauri/src/menu.rs`. A new language is a new dictionary with every key, plus an entry in `LANGS`.

## Development

See [docs/development.md](docs/development.md) for the setup and the architecture.

Before opening a pull request:

- `npm run typecheck`, `npm run build:web` and `cargo check` (in `src-tauri`) pass,
- you tried your change in `npm run dev`,
- Plume stays simple: it is made for people who do not know Markdown; new options need a good reason,
- no heavy dependency (small installers are a goal), `npm audit --omit=dev` stays clean,
- commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
  `docs:`…) and explain *why* when it isn't obvious.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
