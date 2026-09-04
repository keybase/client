#!/bin/bash
# Fetch open Copilot review feedback for a PR, from BOTH places it can live:
#
#   1. Inline review threads  - the classic form. Skips hidden comments only
#      (resolved threads or minimized comments). Outdated threads are still
#      shown, tagged [OUTDATED]: the diff position moved but the underlying
#      issue often still exists in the current code.
#
#   2. Review bodies          - as of 2026-09 Copilot frequently reports
#      "Comments generated: 0" and puts its actual findings in the review body
#      instead, under "### Suppressed comments". Those never appear as threads,
#      so a thread-only query silently returns nothing and the review looks
#      clean when it is not.
#
# Usage: ./get-copilot-feedback.sh <pr-number>
set -euo pipefail

PR=${1:-$(gh pr view --json number -q .number)}
OWNER=$(gh repo view --json owner -q .owner.login)
REPO=$(gh repo view --json name -q .name)

echo "=== Inline review threads ==="
gh api graphql -f query='
query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){
    pullRequest(number:$pr){
      reviewThreads(first:100){
        nodes{
          isResolved
          isOutdated
          comments(first:1){
            nodes{ author{login} isMinimized path line originalLine body }
          }
        }
      }
    }
  }
}' -F owner="$OWNER" -F repo="$REPO" -F pr="$PR" --jq '
  .data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved == false) as $thread
  | $thread.comments.nodes[0]
  | select(.isMinimized == false)
  | select(.author.login == "Copilot" or .author.login == "copilot-pull-request-reviewer")
  | "[\(.path):\(.line // .originalLine)]\(if $thread.isOutdated then " [OUTDATED]" else "" end)\n\(.body)\n"
' || true

echo
echo "=== Review bodies (verdict + suppressed comments) ==="
# Copilot's body is markdown with collapsible <details>. The parts worth reading are the
# headline verdict, the one-line concern under it, and the "Suppressed comments" block -
# NOT the per-file summary table, which is a restatement of the diff.
gh api "repos/$OWNER/$REPO/pulls/$PR/reviews" --paginate --jq '
  .[]
  | select(.user.login == "Copilot" or .user.login == "copilot-pull-request-reviewer[bot]" or .user.login == "copilot-pull-request-reviewer")
  | select(.body != null and .body != "")
  | "--- \(.submitted_at) [\(.state)] ---\n\(.body)\n"
' | awk '
  /^--- / { print; next }
  /^### / && !/Suppressed/ { print; next }                 # headline verdict
  /^<details>/ { indetails=1 }
  /^<\/details>/ { indetails=0; next }
  /Suppressed comments/ { suppressed=1; print; next }
  /^- \*\*Files reviewed:/ { suppressed=0 }
  suppressed { print; next }
  !indetails && NF && !/^<\/?details/ && !/^<summary>/ && !/^💡/ && !/^\| / && !/^\| ?-/ { print }
' | sed '/^$/N;/^\n$/D'
