#! /bin/bash

#
# kbfsstage_release.sh creates kbfsstage releases.
#
# Call it with client and kbfs version number:
#
#    kbfsstage_release.sh <client version> <kbfs version>
#
# It does the following:
#
# 1. tags the kbfs repo with a version tag
# 2. exports the code to the kbfs-beta repo
# 3. updates the kbfsstage brew formula
#

set -e -u -o pipefail

if [ "$#" -lt 2 ] ; then
	echo Usage: $0 CLIENT_VERSION KBFS_VERSION
	echo versions should be something like 1.0.3-245
	exit 1
fi

client_version="$1"
client_version_tag="v$client_version"
kbfs_version="$2"
kbfs_version_tag="v$kbfs_version"

clientdir="$GOPATH/src/github.com/keybase/client"
kbfsdir="$GOPATH/src/github.com/keybase/kbfs"
if [ "$BETADIR" = "" ]; then
	BETADIR="$GOPATH/src/github.com/keybase/client-beta"
fi
if [ "$BREWDIR" = "" ]; then
	BREWDIR="$GOPATH/src/github.com/keybase/homebrew-beta"
fi

if [ ! -d "$clientdir" ]; then
	echo "Need client repo, expecting it here: $clientdir"
	exit 1
fi

if [ ! -d "$kbfsdir" ]; then
	echo "Need kbfs repo, expecting it here: $kbfsdir"
	exit 1
fi

if [ ! -d "$BETADIR" ]; then
	echo "Need kbfs-beta repo, expecting it here: $BETADIR"
	exit 1
fi

if [ ! -d "$BREWDIR" ]; then
	echo "Need homebrew-beta repo, expecting it here: $BREWDIR"
	exit 1
fi

src_version="$(egrep -o "([0-9]{1,}\.)+[0-9]{1,}" $kbfsdir/libkbfs/version.go)"
build_number="$(egrep -o "const Build = \"\d+\"" $kbfsdir/libkbfs/version.go | egrep -o "\d+")"

if [ "$kbfs_version" != "$src_version-$build_number" ]; then
	echo Version $kbfs_version does not match libkbfs/version.go $src_version-$build_number
	echo source version: $src_version
	echo build number:   $build_number
	exit 1
fi

echo "-------------------------------------------------------------------------"
echo "Creating kbfsstage release for version $kbfs_version"
echo "-------------------------------------------------------------------------"
echo "1. Tagging kbfs source with $kbfs_version_tag"
cd $kbfsdir
git tag -a $kbfs_version_tag -m $kbfs_version_tag
git push --tags

echo "2. Exporting client source to kbfs-beta for version $client_version"
$clientdir/packaging/export/export.sh client $BETADIR $client_version_tag
cd $BETADIR
git add .
git commit -m "Importing client source from $client_version_tag"
git push

echo "3. Exporting kbfs source to kbfs-beta for version $kbfs_version"
$clientdir/packaging/export/export.sh kbfs $BETADIR $kbfs_version_tag
cd $BETADIR
git add .
git commit -m "Importing kbfs source from $kbfs_version_tag"
git push
git tag -a $kbfs_version_tag -m $kbfs_version_tag
git push --tags

src_url="https://github.com/keybase/kbfs-beta/archive/$kbfs_version_tag.tar.gz"
src_sha="$(curl -L -s $src_url | shasum -a 256 | cut -f 1 -d ' ')"
echo "sha256 of src: $src_sha"

echo "3. Updating kbfsstage brew formula"
sed -e "s/%VERSION%/$kbfs_version/g" -e "s/%VERSION_TAG%/$kbfs_version_tag/g" -e "s/%SRC_SHA%/$src_sha/g" $BREWDIR/kbfsstage.rb.tmpl > $BREWDIR/kbfsstage.rb
cd $BREWDIR
git commit -a -m "New kbfsstage version $kbfs_version_tag"
git push

echo "4. Done.  brew update && brew upgrade kbfsstage should install version $kbfs_version"
