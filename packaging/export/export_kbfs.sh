
#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

repodir="$GOPATH/src/github.com/keybase/kbfs-beta"
clientdir="$GOPATH/src/github.com/keybase/client"

"$clientdir/packaging/check_status_and_pull.sh" "$repodir"

echo "Loading release tool"
go install github.com/keybase/client/go/tools/release
release_bin="$GOPATH/bin/release"

keybase_version=`$release_bin --repo=client latest-version`
echo "Using latest keybase version: $keybase_version"

kbfs_version=$VERSION
if [ "$kbfs_version" = "" ]; then
  kbfs_version=`$release_bin --repo=kbfs latest-version`
  echo "Using latest kbfs version: $kbfs_version"
fi

./export.sh client $repodir "v$keybase_version"
./export.sh kbfs $repodir "v$kbfs_version"

cd $repodir
tag="v$kbfs_version"
echo "Committing and tagging: $tag"
git add .
git commit -m "New version: $kbfs_version"
git tag -m "$tag" -a "$tag"
git push
git push --tags
