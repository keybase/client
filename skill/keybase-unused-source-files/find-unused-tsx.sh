#!/bin/bash
# Find .tsx files not imported/required anywhere in the Keybase shared/ codebase.
# Outputs a list of candidates — review before deleting.
#
# Run from anywhere; locates shared/ relative to this script.
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
SHARED_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)/shared

IMPORTS_TMP=$(mktemp)
trap 'rm -f "$IMPORTS_TMP"' EXIT

# Collect all import/require lines from every source file.
# Captures: `from '.'`, `import('./`, `require('./`, and bare side-effect `import '.'`
find "$SHARED_ROOT" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.mts" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/coverage-ts/*" \
  -print0 | xargs -0 grep -hE "(from |import\(|import |require\()[\'\"](\.|@)" 2>/dev/null \
  > "$IMPORTS_TMP"

# Returns 0 if the file appears to be imported somewhere
check_tsx() {
  local filepath="$1"
  local stem
  stem=$(basename "$filepath" .tsx)

  if [[ "$stem" == "index" ]]; then
    # Index files are imported by their parent directory name, with or without explicit /index
    local dir parentdir
    dir=$(basename "$(dirname "$filepath")")
    parentdir=$(dirname "$filepath")
    grep -qF "/${dir}'" "$IMPORTS_TMP" && return 0
    grep -qF "/${dir}\"" "$IMPORTS_TMP" && return 0
    grep -qF "/${dir}/index'" "$IMPORTS_TMP" && return 0
    grep -qF "/${dir}/index\"" "$IMPORTS_TMP" && return 0
    # Sibling files using `from '.'`, `import('.')`, or `import('./')` import this index
    find "$parentdir" -maxdepth 1 \( -name "*.ts" -o -name "*.tsx" \) ! -name "index.tsx" \
      -print0 | xargs -0 grep -qlE "(from |import\()['\"]\./?['\"]" 2>/dev/null && return 0
    return 1
  fi

  # Check for exact stem match (handles explicit platform-suffix imports like './html-root.desktop')
  grep -qF "/${stem}'" "$IMPORTS_TMP" && return 0
  grep -qF "/${stem}\"" "$IMPORTS_TMP" && return 0

  # Strip platform suffix and check again (handles bundler-resolved imports like './upload-container')
  local generic="$stem"
  for suffix in .native .desktop .ios .android .mobile; do
    if [[ "$generic" == *"$suffix" ]]; then
      generic="${generic%$suffix}"
      break
    fi
  done

  if [[ "$generic" != "$stem" ]]; then
    grep -qF "/${generic}'" "$IMPORTS_TMP" && return 0
    grep -qF "/${generic}\"" "$IMPORTS_TMP" && return 0
  fi

  return 1
}

# Files loaded by the runtime or Webpack, not via TS imports
ENTRY_POINTS=(
  "local-debug.tsx"
  "node.desktop.tsx"        # Webpack main-process entry
  "preload.desktop.tsx"     # Webpack preload entry
)

echo "=== Potentially orphaned .tsx files ==="
found=0
while IFS= read -r filepath; do
  base=$(basename "$filepath")

  # Skip test files
  [[ "$base" == *.test.tsx ]] && continue

  # Skip generated files
  [[ "$base" == *-gen.* ]] && continue
  [[ "$base" == *-gen2.* ]] && continue

  # Skip known entry points
  for ep in "${ENTRY_POINTS[@]}"; do
    [[ "$base" == "$ep" ]] && continue 2
  done

  if ! check_tsx "$filepath"; then
    echo "  ${filepath#"$SHARED_ROOT/"}"
    found=$((found + 1))
  fi
done < <(find "$SHARED_ROOT" -name "*.tsx" \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/coverage-ts/*" \
  | sort)

echo ""
echo "Total: $found candidates"
echo ""
echo "Note: dynamic imports via variables and config-driven routes may not be"
echo "detected. Verify each candidate before deleting."
