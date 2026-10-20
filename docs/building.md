# Building and releasing

## Local builds

`npm run dist` builds the installers of the current system into `src-tauri/target/release/bundle`.
macOS: add `-- --target universal-apple-darwin` (after `rustup target add x86_64-apple-darwin
aarch64-apple-darwin`) for one app for Apple Silicon and Intel. Local builds are not signed.

## Release workflow

`.github/workflows/build.yml` runs on `v*` tags and on demand:

| Job | Runner | Output |
| --- | ------ | ------ |
| `build-macos` | macos-latest | universal `.dmg`, signed and notarized on tags |
| `build-linux` | ubuntu-22.04 and ubuntu-22.04-arm | `.AppImage`, `.deb`, `.rpm` for x64 and arm64 |
| `build-windows` | ubuntu-24.04 | NSIS installer `-setup.exe` and `-portable.exe`, cross-compiled with cargo-xwin, signed on tags |
| `release` | ubuntu-latest | draft GitHub release with every file (pre-release for `-rc` tags) |

To release: update the version in `package.json`, `src-tauri/Cargo.toml` and
`src-tauri/tauri.conf.json`, move the *Unreleased* changelog entries under the new version, commit,
then push an annotated tag `vX.Y.Z`. Check the draft release, then publish it.

## Signing

Without the secrets below (forks, pull requests, manual runs) packages are built unsigned.

### macOS

Developer ID Application certificate + notarization with an App Store Connect API key:

| Secret | Content |
| ------ | ------- |
| `MAC_CSC_LINK` | the certificate and its private key as a base64 `.p12` |
| `MAC_CSC_KEY_PASSWORD` | the `.p12` password |
| `APPLE_API_KEY_BASE64` | the App Store Connect API key (`AuthKey_XXXX.p8`) in base64 |
| `APPLE_API_KEY_ID` | its key ID |
| `APPLE_API_ISSUER` | its issuer ID |

The workflow imports the certificate into a dedicated keychain (the hosted runners' default keychain
handling is unreliable), passes the identity to the Tauri CLI with `APPLE_SIGNING_IDENTITY`, and the
CLI notarizes and staples. The job then checks the signature, Gatekeeper's verdict and the ticket.

### Windows

Certum "Code Signing in the Cloud" through [ssign](https://github.com/Le-Syl21/ssign), from Linux
(no SimplySign Desktop). On tags, the workflow sets `bundle.windows.signCommand` to
`build/sign-win.sh`, which the Tauri bundler calls for the app executable and the installer. The
bundler puts the unsigned binary back in `target/` afterwards, so the workflow copies it as the
portable exe and signs that copy itself; it checks the installer, the app extracted from it (7-Zip)
and the portable exe.

| Secret | Content |
| ------ | ------- |
| `CERTUM_USERNAME` | the Certum account e-mail |
| `CERTUM_TOTP_SECRET` | the SimplySign TOTP secret, Base32 |

ssign is pinned to a release and verified by SHA-256 before it receives secrets.

### Linux

Packages are not signed; the release page lists their checksums.
