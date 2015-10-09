#! /bin/bash

#
# release.sh creates keybase releases.
#
# Call it with a mode and version number:  release.sh staging 1.1.12-102
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
betadir=${BETADIR:-$GOPATH/src/github.com/keybase/client-beta}
brewdir=${BREWDIR:-$GOPATH/src/github.com/keybase/homebrew-beta}
serveropsdir=${SERVEROPSDIR:-$GOPATH/src/github.com/keybase/server-ops}

if [ ! -d "$clientdir" ]; then
	echo "Need client repo, expecting it here: $clientdir"
	exit 1
fi

if [ ! -d "$betadir" ]; then
	echo "Need client-beta repo, expecting it here: $betadir"
	exit 1
fi

if [ ! -d "$brewdir" ]; then
	echo "Need homebrew-beta repo, expecting it here: $brewdir"
	exit 1
fi

if [ ! -d "$serveropsdir" ]; then
	echo "Need server-ops repo, expecting it here: $serveropsdir"
	exit 1
fi

version_on_disk="$("$clientdir/packaging/version.sh")"

if [ "$version" != "$version_on_disk" ]; then
	echo Version $version does not match libkb/version.go $version_on_disk
	exit 1
fi

# Make sure you have the Keybase code signing key.
code_signing_fingerprint="$(cat $serveropsdir/deploy/lib/code_signing_fingerprint)"
if ! gpg -K "$code_signing_fingerprint" ; then
	echo "You're missing the GPG code signing secret key ($code_signing_fingerprint)."
	exit 1
fi

echo "-------------------------------------------------------------------------"
echo "Creating $formula release for version $version"
echo "-------------------------------------------------------------------------"
cd $clientdir
if git tag -a $version_tag -m $version_tag ; then 
	echo "Tagged client source with $version_tag"
	git push --tags
	
	echo "Exporting client source to client-beta for version $version"
	$clientdir/packaging/export/export.sh client $betadir $version_tag
	cd $betadir
	git add .
	git commit -m "Importing from $version_tag"
	git push
	git tag -a $version_tag -m $version_tag
	git push --tags
else 
	echo "git tag $version_tag failed on $clientdir, presumably it exists"
	echo "skipped client source export to client-beta for version $version"
fi

src_url="https://github.com/keybase/client-beta/archive/$version_tag.tar.gz"
echo "Computing sha256 of $src_url"
src_sha="$(curl -L -s $src_url | shasum -a 256 | cut -f 1 -d ' ')"
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
"$serveropsdir/deploy/linux_docker_build.sh" "$mode" "$version_tag"
