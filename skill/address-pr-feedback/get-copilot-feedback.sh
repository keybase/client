#!/bin/bash
# Fetch open (non-hidden) Copilot inline review comments for a PR.
# Usage: ./get-copilot-feedback.sh <pr-number>
# "Hidden" = position is null (diff is outdated). Those are ignored.
set -euo pipefail

PR=${1:-$(gh pr view --json number -q .number)}
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

gh api "repos/$REPO/pulls/$PR/comments" \
  --jq '
    .[]
    | select(.user.login == "Copilot" or .user.login == "copilot-pull-request-reviewer")
    | select(.position != null)
    | "[\(.path):\(.line // .original_line)]\n\(.body)\n"
  '
