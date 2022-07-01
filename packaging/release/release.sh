#! /usr/bin/env bash

#
# release.sh creates keybase releases.
#
# Call it with a mode and version number:  release.sh staging 1.1.12-102
#
# Before you call this, you need to:
# 1. update the version number in go/libkb/version.go
# 2. edit the CHANGELOG
# 3. commit and push both of those things
#
# This script does the following:
# 1. tags the client repo with a version tag
# 2. update the kbstage brew formulas
# 3. build the Linux packages
#
# After this script, you need to:
# 1. SSH to dist.keybase.io and pull the server-ops repo, for Linux packages

set -e -u -o pipefail

if [ "$#" -lt 2 ] ; then
	echo Usage: release.sh MODE VERSION
	echo MODE should be staging or production
	echo VERSION should be something like 1.0.3-245
	exit 1
fi

mode="$1"
version="$2"
version_tag="v$version"

if [ $mode == "staging" ]; then
	formula="kbstage"
elif [ $mode == "production" ]; then
	formula="keybase"
else
	echo "Invalid mode $mode.  Should be staging or production."
	exit 1
fi

clientdir="$GOPATH/src/github.com/keybase/client"
brewdir=${BREWDIR:-$GOPATH/src/github.com/keybase/homebrew-beta}
serveropsdir=${SERVEROPSDIR:-$GOPATH/src/github.com/keybase/server-ops}
kbfsdir=${KBFSDIR:-$GOPATH/src/github.com/keybase/client/go/kbfs}

"$clientdir/packaging/check_status_and_pull.sh" "$clientdir"
"$clientdir/packaging/check_status_and_pull.sh" "$brewdir"
"$clientdir/packaging/check_status_and_pull.sh" "$serveropsdir"
"$clientdir/packaging/check_status_and_pull.sh" "$kbfsdir"

version_on_disk="$("$clientdir/packaging/version.sh" "$mode")"

if [ "$version" != "$version_on_disk" ]; then
	echo Version $version does not match libkb/version.go $version_on_disk
	exit 1
fi

echo "-------------------------------------------------------------------------"
echo "Creating $formula release for version $version"
echo "-------------------------------------------------------------------------"
cd $clientdir

if git tag -a $version_tag -m $version_tag ; then
	echo "Tagged client source with $version_tag"
	git push --tags
else
	echo "git tag $version_tag failed on $clientdir, presumably it exists"
fi

src_url="https://github.com/keybase/client/archive/$version_tag.tar.gz"
echo "Computing sha256 of $src_url"
src_sha="$(curl -f -L -s $src_url | shasum -a 256 | cut -f 1 -d ' ')"
echo "sha256 of $src_url is $src_sha"

echo "Updating brew formula $formula"
sed -e "s/%VERSION%/$version/g" -e "s/%VERSION_TAG%/$version_tag/g" -e "s/%SRC_SHA%/$src_sha/g" $brewdir/$formula.rb.tmpl > $brewdir/$formula.rb
cd $brewdir
if git commit -a -m "New $formula version $version_tag" ; then
	git push
	echo "Done.  brew update && brew upgrade $formula should install version $version"
else
	echo "$brewdir/$formula.rb did not change."
fi

echo "-------------------------------------------------------------------------"
echo "Creating Linux packages for version $version"
echo "-------------------------------------------------------------------------"

# Make sure you have the Keybase code signing key.
code_signing_fingerprint="$(cat $clientdir/packaging/linux/code_signing_fingerprint)"
if ! gpg -K "$code_signing_fingerprint" ; then
	echo "You're missing the GPG code signing secret key ($code_signing_fingerprint)."
	exit 1
fi

"$clientdir/packaging/linux/docker_build.sh" "$mode" "$version_tag"
