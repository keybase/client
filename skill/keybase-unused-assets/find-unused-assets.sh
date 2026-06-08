#!/bin/bash
# Run from shared/
set -euo pipefail

SHARED_ROOT=$(cd "$(dirname "$0")/../.." && pwd)/shared

EXCLUDED_FILES=(
  "$SHARED_ROOT/common-adapters/icon.constants-gen.shared.tsx"
  "$SHARED_ROOT/common-adapters/icon.constants-gen.d.ts"
  "$SHARED_ROOT/common-adapters/icon.css"
  "$SHARED_ROOT/desktop/yarn-helper/font.mts"
)

# Build source file list excluding generated files and node_modules
find "$SHARED_ROOT" -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/node_modules/*" \
  | grep -vF "$(IFS=$'\n'; echo "${EXCLUDED_FILES[*]}")" \
  > /tmp/asset-check-sources.txt

check_asset() {
  local name="$1"
  IFS='-' read -ra segs <<< "$name"
  local total=${#segs[@]}
  for ((keep=total; keep>=2; keep--)); do
    local candidate
    candidate=$(IFS='-'; echo "${segs[*]:0:$keep}")
    [ $keep -lt $total ] && candidate="${candidate}-"
    if xargs grep -ql "$candidate" < /tmp/asset-check-sources.txt 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

echo "=== images/icons ==="
for f in "$SHARED_ROOT/images/icons"/*.png "$SHARED_ROOT/images/icons"/*.jpg; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  # skip @2x/@3x variants
  [[ "$base" == *@* ]] && continue
  name="${base%.*}"
  check_asset "$name" || echo "  UNUSED: $name"
done

echo "=== images/illustrations ==="
for f in "$SHARED_ROOT/images/illustrations"/*.png "$SHARED_ROOT/images/illustrations"/*.jpg; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  [[ "$base" == *@* ]] && continue
  name="${base%.*}"
  check_asset "$name" || echo "  UNUSED: $name"
done

echo "=== images/iconfont ==="
for f in "$SHARED_ROOT/images/iconfont"/*.svg; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  # e.g. "42-kb-iconfont-add-16.svg" → "iconfont-add"
  name=$(echo "$base" | sed 's/^[0-9]*-kb-//' | sed 's/-[0-9]*\.svg$//')
  xargs grep -ql "$name" < /tmp/asset-check-sources.txt 2>/dev/null || echo "  UNUSED: $name"
done
