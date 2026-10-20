# Security policy

Plume opens documents that may come from anywhere, so security reports are taken seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub's
[private vulnerability reporting](https://github.com/croos555/plume/security/advisories/new)
with a description, the affected version and steps to reproduce.

You can expect an acknowledgement within a few days. Once a fix is released, the issue can be made
public and you will be credited if you wish.

## Scope

In scope: anything a malicious Markdown document could do beyond being displayed (script
execution, reading or writing files, reaching the Tauri commands), file overwrites or data loss when
saving, and the update or packaging chain.

See [docs/security.md](docs/security.md) for how Plume handles documents.
