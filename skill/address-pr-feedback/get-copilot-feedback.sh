#!/bin/bash
# Fetch open Copilot inline review comments for a PR.
# Usage: ./get-copilot-feedback.sh <pr-number>
# Skips only hidden comments: resolved threads or minimized comments.
# Outdated threads (diff position moved) are still shown, tagged [OUTDATED] —
# the issue may still exist in the current code and must be evaluated.
set -euo pipefail

PR=${1:-$(gh pr view --json number -q .number)}
OWNER=$(gh repo view --json owner -q .owner.login)
REPO=$(gh repo view --json name -q .name)

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
'
