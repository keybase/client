#!/bin/bash
# Compares baseline vs current screenshots using ImageMagick.
# Usage: ./visual-diff-compare.sh
#
# Prerequisites:
#   - ImageMagick installed (brew install imagemagick)
#   - Baseline screenshots in /tmp/visual-diff/baseline/
#   - Current screenshots in /tmp/visual-diff/current/
#
# Output:
#   - Diff images in /tmp/visual-diff/diff/
#   - Summary table with pixel counts

set -euo pipefail

BASE_DIR="/tmp/visual-diff"
BASELINE="$BASE_DIR/baseline"
CURRENT="$BASE_DIR/current"
DIFF="$BASE_DIR/diff"

if [[ ! -d "$BASELINE" ]]; then
  echo "ERROR: No baseline screenshots found at $BASELINE/"
  echo "Run: ./visual-diff-take.sh baseline"
  exit 1
fi

if [[ ! -d "$CURRENT" ]]; then
  echo "ERROR: No current screenshots found at $CURRENT/"
  echo "Run: ./visual-diff-take.sh current"
  exit 1
fi

RESIZED="$BASE_DIR/resized"
mkdir -p "$DIFF" "$RESIZED"

if ! command -v magick &>/dev/null; then
  echo "ERROR: ImageMagick not found. Install with: brew install imagemagick"
  exit 1
fi

echo "Comparing baseline vs current..."
echo ""
printf "%-12s %10s  %s\n" "Tab" "Diff px" "Status"
printf "%-12s %10s  %s\n" "---" "-------" "------"

TOTAL_DIFF=0
ISSUES=()

for img in "$BASELINE"/*.png; do
  name=$(basename "$img" .png)
  baseline_img="$BASELINE/${name}.png"
  current_img="$CURRENT/${name}.png"
  diff_img="$DIFF/${name}.png"

  if [[ ! -f "$current_img" ]]; then
    printf "%-12s %10s  %s\n" "$name" "-" "MISSING"
    ISSUES+=("$name: no current screenshot")
    continue
  fi

  # Ensure images are the same size (CDP may capture at 2x, Playwright at 1x)
  baseline_size=$(identify -format "%wx%h" "$baseline_img")
  current_size=$(identify -format "%wx%h" "$current_img")
  compare_baseline="$baseline_img"
  compare_current="$current_img"

  if [[ "$baseline_size" != "$current_size" ]]; then
    # Resize the larger one down to match the smaller
    magick "$current_img" -resize "$baseline_size!" "$RESIZED/${name}.png"
    compare_current="$RESIZED/${name}.png"
  fi

  # Compare and capture pixel diff count (exit code 1 = images differ, not an error)
  diff_px=$(magick compare -metric AE "$compare_baseline" "$compare_current" "$diff_img" 2>&1 || true)
  diff_px=$(echo "$diff_px" | awk '{print int($1)}')

  # Classify the result
  if [[ "$diff_px" -eq 0 ]]; then
    status="PERFECT"
  elif [[ "$diff_px" -lt 200 ]]; then
    status="ok (subpixel)"
  elif [[ "$diff_px" -lt 2000 ]]; then
    status="REVIEW"
    ISSUES+=("$name: $diff_px px differ — check $diff_img")
  else
    status="REGRESSION"
    ISSUES+=("$name: $diff_px px differ — likely visual regression, check $diff_img")
  fi

  printf "%-12s %10s  %s\n" "$name" "$diff_px" "$status"
  TOTAL_DIFF=$((TOTAL_DIFF + diff_px))
done

echo ""
echo "Total differing pixels: $TOTAL_DIFF"
echo "Diff images saved to: $DIFF/"

if [[ ${#ISSUES[@]} -gt 0 ]]; then
  echo ""
  echo "=== Items to review ==="
  for issue in "${ISSUES[@]}"; do
    echo "  - $issue"
  done
  echo ""
  echo "How to evaluate diff images:"
  echo "  - Open the diff PNG — red pixels show differences"
  echo "  - Subpixel noise: scattered faint red dots, typically <200px — safe to ignore"
  echo "  - Dynamic content: avatars, timestamps, badges change between runs — safe to ignore"
  echo "  - COLOR REGRESSION: entire icons or areas are solid red — icon color changed"
  echo "  - SIZE/POSITION REGRESSION: red outlines around elements — something shifted"
  echo "  - Use 'open $DIFF/<tab>.png' to view, or read them in Claude for analysis"
fi
