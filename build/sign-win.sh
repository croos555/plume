#!/usr/bin/env bash
# Windows signing hook for the Tauri bundler (bundle.windows.signCommand, set by the release
# workflow only): Certum "Code Signing in the Cloud" through ssign (https://github.com/Le-Syl21/ssign),
# which talks to Certum's cloud API over HTTPS from Linux. ssign signs in place with SHA-256, embeds the
# Certum chain and adds an RFC 3161 timestamp; it caches the cloud session, so all files share one login.
# The cloud and the timestamp server occasionally time out: retry a few times.
set -euo pipefail
file="$1"
for attempt in 1 2 3; do
  if "${SSIGN_PATH:-ssign}" "$file"; then
    exit 0
  fi
  if [ "$attempt" -lt 3 ]; then
    echo "ssign failed (attempt $attempt), retrying in $((attempt * 10)) s…" >&2
    sleep $((attempt * 10))
  fi
done
exit 1
