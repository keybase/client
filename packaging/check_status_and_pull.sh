#! /usr/bin/env bash

# There are lots of places where we need to check stuff like:
#   1) Does repo X exist?
#   2) Does it have master checked out?
#   3) It is clean?
#   4) Is it up to date?
# This script takes care of all that.

set -e -u -o pipefail

repo="${1:-}"
if [ -z "$repo" ] ; then
  echo "check_status_and_pull.sh needs a repo argument."
  exit 1
fi

if [ ! -d "$repo" ] ; then
  echo "Repo directory '$repo' does not exist."
  exit 1
fi

cd "$repo"

if [ ! -d ".git" ] ; then
  # This intentionally doesn't support bare repos. Some callers are going to
  # want to mess with the working copy.
  echo "Directory '$repo' is not a git repo."
  exit 1
fi

# fetch upstream
git fetch

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "master" ] ; then
  echo "Repo '$repo' doesn't have master checked out."
  exit 1
fi

current_status="$(git status --porcelain)"
if [ -n "$current_status" ] ; then
  echo "Repo '$repo' isn't clean."
  exit 1
fi

unpushed_commits="$(git log origin/master..master)"
if [ -n "$unpushed_commits" ] ; then
  echo "Repo '$repo' has unpushed commits."
  exit 1
fi

echo "Repo '$repo' looks good. Pulling..."
git pull --ff-only
