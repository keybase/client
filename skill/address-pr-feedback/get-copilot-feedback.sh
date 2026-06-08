#!/bin/bash
# Fetch open (non-hidden) Copilot inline review comments for a PR.
# Usage: ./get-copilot-feedback.sh <pr-number>
# "Hidden" = the review thread is resolved or outdated. Those are ignored.
# Resolved/outdated state lives on the GraphQL review thread, not the REST
# comment's `position` field, so a resolved comment can still have position != null.
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
            nodes{ author{login} path line originalLine body }
          }
        }
      }
    }
  }
}' -F owner="$OWNER" -F repo="$REPO" -F pr="$PR" --jq '
  .data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved == false and .isOutdated == false)
  | .comments.nodes[0]
  | select(.author.login == "Copilot" or .author.login == "copilot-pull-request-reviewer")
  | "[\(.path):\(.line // .originalLine)]\n\(.body)\n"
'
