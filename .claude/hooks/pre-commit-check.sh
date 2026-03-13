#!/bin/bash

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE "git commit"; then
  REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)

  echo "Running yarn lint..." >&2
  if ! (cd "$REPO_ROOT/shared" && yarn lint 2>&1); then
    echo "Lint failed — commit blocked." >&2
    exit 2
  fi

  echo "Running yarn tsc..." >&2
  if ! (cd "$REPO_ROOT/shared" && yarn tsc 2>&1); then
    echo "TypeScript check failed — commit blocked." >&2
    exit 2
  fi

  echo "Pre-commit checks passed." >&2
fi

exit 0
