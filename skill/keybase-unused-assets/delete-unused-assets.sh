#!/bin/bash
# Delete specific unused assets by name, then regenerate icon constants.
# Usage: ./delete-unused-assets.sh icon-foo-bar icon-baz-qux ...
# Run from anywhere in the repo.
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <asset-name> [<asset-name> ...]"
  echo "Example: $0 icon-foo-bar illustration-welcome"
  exit 1
fi

SHARED_ROOT=$(cd "$(dirname "$0")/../.." && pwd)/shared

ICON_DIRS=(
  "$SHARED_ROOT/images/icons"
  "$SHARED_ROOT/images/illustrations"
  "$SHARED_ROOT/images/iconfont"
)

deleted=0
for name in "$@"; do
  for dir in "${ICON_DIRS[@]}"; do
    # Match exact name with any extension or @2x/@3x suffix
    for f in "$dir/$name".* "$dir/$name"@*.* "$dir"/*-"$name"-*.svg; do
      [ -f "$f" ] || continue
      echo "Deleting: $f"
      rm "$f"
      ((deleted++)) || true
    done
    # iconfont: match "NN-kb-<name>-NN.svg"
    for f in "$dir"/*-kb-"$name"-*.svg; do
      [ -f "$f" ] || continue
      echo "Deleting: $f"
      rm "$f"
      ((deleted++)) || true
    done
  done
done

echo "Deleted $deleted file(s)."
echo "Regenerating icon constants..."
cd "$SHARED_ROOT" && yarn gen:icon-constants
