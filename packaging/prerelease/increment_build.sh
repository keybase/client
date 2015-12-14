#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

# For Keybase
# "$GOPATH/src/github.com/keybase/client/" "$GOPATH/src/github.com/keybase/client/go/libkb/version.go" "client" "libkb" $@

# For KBFS
# "$GOPATH/src/github.com/keybase/kbfs/" "$GOPATH/src/github.com/keybase/kbfs/libkbfs/version.go" "kbfs" "libkbfs" $@

repodir=${1:-$GOPATH/src/github.com/keybase/client}
version_file=${2:-$repodir/go/libkb/version.go}
repo=${3:-client}
pkg=${4:-libkb}
opt=${5:-none}

clientdir="$GOPATH/src/github.com/keybase/client"

cd $repodir

echo "Loading release tool"
go install github.com/keybase/client/go/tools/release
release_bin="$GOPATH/bin/release"

"$clientdir/packaging/check_status_and_pull.sh" "$repodir"

version_before=${VERSION:-}
if [ "$version_before" = "" ]; then
  version_before=`$release_bin --repo=$repo latest-version`
fi

# Increment build
echo "Editing $version_file"
version_after=`$release_bin -version "$version_before" -pkg "$pkg" -dest "$version_file" increment-build`
gofmt -w "$version_file"

echo "Updated version: $version_after"
tag="v$version_after"

commit_tag() {
  echo "Committing and tagging: $tag"
  git add "$version_file"
  git commit -m "Bumping build number: $version_after"
  git tag -m "$tag" -a "$tag"
  git push
  git push --tags
}

revert() {
  echo "Reverting"
  git checkout "$version_file"
}

if [ "$opt" = "auto" ]; then
  commit_tag
else
  echo "Do you want commit and tag ($tag)?"
  select res in "Commit" "Revert" "Quit"; do
      case $res in
          Commit ) commit_tag; break;;
          Revert ) revert; break;;
          Quit ) exit;;
      esac
  done
fi
