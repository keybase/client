#!/bin/bash
# Clear keybase logs so the next run is the only thing in them.
#
#   ./clean-logs.sh            # list what would move, change nothing
#   ./clean-logs.sh --archive  # move them to ~/Library/Logs/keybase-archive-<ts>/
#   ./clean-logs.sh --delete   # remove them
#
# Default is a dry run: an unattended --delete on the wrong machine is not
# recoverable, and the logs are often the only record of a run.
set -euo pipefail

LOGDIR="$HOME/Library/Logs"
MODE="${1:-}"

shopt -s nullglob
FILES=("$LOGDIR"/keybase*.log "$LOGDIR"/keybase*.log-* "$LOGDIR"/Keybase.app.log)
shopt -u nullglob

if [ ${#FILES[@]} -eq 0 ]; then
  echo "no keybase logs in $LOGDIR"
  exit 0
fi

TOTAL=$(du -ch "${FILES[@]}" 2>/dev/null | tail -1 | cut -f1)
echo "${#FILES[@]} files, $TOTAL:"
for f in "${FILES[@]}"; do
  printf '  %8s  %s\n' "$(du -h "$f" | cut -f1)" "$(basename "$f")"
done

case "$MODE" in
  --archive)
    DEST="$LOGDIR/keybase-archive-$(date +%Y%m%dT%H%M%S)"
    mkdir -p "$DEST"
    mv "${FILES[@]}" "$DEST/"
    echo "moved to $DEST"
    ;;
  --delete)
    rm -f "${FILES[@]}"
    echo "deleted"
    ;;
  *)
    echo
    echo "dry run. pass --archive to move them aside, or --delete to remove them."
    ;;
esac
