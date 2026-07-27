#!/usr/bin/env bash
# shared/node_modules/react-native-kb is a `file:` COPY, not a symlink, and
# expo autolinking points gradle/pods at it. Native edits under rnmodules/
# are invisible to a build until they are copied across.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SRC="$ROOT/rnmodules/react-native-kb"
DST="$ROOT/shared/node_modules/react-native-kb"
test -d "$DST" || { echo "missing $DST — run yarn in shared/ first" >&2; exit 1; }
for d in cpp ios android; do
  rsync -a --delete "$SRC/$d/" "$DST/$d/"
done
echo "synced rnmodules/react-native-kb -> shared/node_modules/react-native-kb"
