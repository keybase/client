#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

clientdir="$GOPATH/src/github.com/keybase/client"
version_file="$clientdir/go/libkb/version.go"

echo "Loading release tool"
go install github.com/keybase/client/go/tools/release
release_bin="$GOPATH/bin/release"

"$clientdir/packaging/check_status_and_pull.sh" "$clientdir"

version_before=`$release_bin version`
echo "Version: $version_before"

# Increment build
$release_bin -src "$version_file" increment-build
gofmt -w "$version_file"

version_after=`$release_bin version`
echo "Updated version: $version_after"
tag="v$version_after"

commit_tag() {
  echo "Committing and tagging: $tag"
  git add "$version_file"
  git commit -m "Bumping build number: $version_after"
  git tag -m "$tag" -a "$tag"
  git push --tags
}

revert() {
  echo "Reverting"
  git checkout "$version_file"
}

echo "\nDo you want commit and tag ($tag)?"
select res in "Commit" "Revert" "Quit"; do
    case $res in
        Commit ) commit_tag; break;;
        Revert ) revert; break;;
        Quit ) exit;;
    esac
done
