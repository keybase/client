#!/bin/bash

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)

if [ ! -d "$REPO_ROOT/shared/node_modules" ]; then
  echo "node_modules not installed — skipping lint/tsc." >&2
  exit 0
fi

if ! (cd "$REPO_ROOT/shared" && yarn lint 2>&1); then
  echo "Lint failed — commit blocked." >&2
  exit 2
fi

if ! (cd "$REPO_ROOT/shared" && yarn tsc 2>&1); then
  echo "TypeScript check failed — commit blocked." >&2
  exit 2
fi

echo "Pre-commit checks passed." >&2
