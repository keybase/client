#! /bin/bash

#
# kbstage_release.sh creates kbstage releases.
#
# Call it with a version number:  kbstage_release.sh 1.1.12-102
#
# It does the following:
#
# 1. tags the client repo with a version tag
# 2. exports the code to the client-beta repo
# 3. updates the kbstage brew formula
#
# Soon, it will also call the linux package build script...
#

set -e -u -o pipefail

if [ "$#" -lt 1 ] ; then
	echo Usage: $0 VERSION
	echo VERSION should be something like 1.0.3-245
	exit 1
fi

version="$1"
version_tag="v$version"

clientdir="$GOPATH/src/github.com/keybase/client"
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

if [ ! -d "$BETADIR" ]; then
	echo "Need client-beta repo, expecting it here: $BETADIR"
	exit 1
fi

if [ ! -d "$BREWDIR" ]; then
	echo "Need homebrew-beta repo, expecting it here: $BREWDIR"
	exit 1
fi

src_version="$(egrep -o "([0-9]{1,}\.)+[0-9]{1,}" $clientdir/go/libkb/version.go)"
build_number="$(egrep -o "const Build = \"\d+\"" $clientdir/go/libkb/version.go | egrep -o "\d+")"


if [ "$version" != "$src_version-$build_number" ]; then
	echo Version $version does not match libkb/version.go $src_version-$build_number
	echo source version: $src_version
	echo build number:   $build_number
	exit 1
fi

echo "-------------------------------------------------------------------------"
echo "Creating kbstage release for version $version"
echo "-------------------------------------------------------------------------"
echo "1. Tagging client source with $version_tag"
cd $clientdir
git tag -a $version_tag -m $version_tag
git push --tags

echo "2. Exporting client source to client-beta for version $version"
$clientdir/packaging/export/export.sh client $BETADIR $version_tag
cd $BETADIR
git add .
git commit -m "Importing from $version_tag"
git push
git tag -a $version_tag -m $version_tag
git push --tags

src_url="https://github.com/keybase/client-beta/archive/$version_tag.tar.gz"
src_sha="$(curl -L -s $src_url | shasum -a 256 | cut -f 1 -d ' ')"
echo "sha256 of src: $src_sha"

echo "3. Updating kbstage brew formula"
sed -e "s/%VERSION%/$version/g" -e "s/%VERSION_TAG%/$version_tag/g" -e "s/%SRC_SHA%/$src_sha/g" $BREWDIR/kbstage.rb.tmpl > $BREWDIR/kbstage.rb
cd $BREWDIR
git commit -a -m "New kbstage version $version_tag"
git push

echo "4. Done.  brew update && brew upgrade kbstage should install version $version"

# TODO: run linux package maker script here...
