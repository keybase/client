
#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

repodir="$GOPATH/src/github.com/keybase/kbfs-beta"
clientdir="$GOPATH/src/github.com/keybase/client"

"$clientdir/packaging/check_status_and_pull.sh" "$repodir"

echo "Loading release tool"
go install github.com/keybase/release
release_bin="$GOPATH/bin/release"

kbfs_version=$VERSION
if [ "$kbfs_version" = "" ]; then
  kbfs_version=`$release_bin latest-version --user=keybase --repo=kbfs`
  echo "Using latest kbfs version: $kbfs_version"
fi

./export.sh kbfs $repodir "v$kbfs_version"

cd $repodir
tag="v$kbfs_version"
echo "Committing and tagging: $tag"
git add .
git commit -m "New version: $kbfs_version"
git tag -m "$tag" -a "$tag"
git push
git push --tags
