#!/usr/bin/env bash

# Note:  this script isn't bulletproof, and you have to kind of know what you
# are doing (editing the formula by hand, etc.), but it saves some time.
#
# Steps taken from here:
#
# https://github.com/Homebrew/homebrew/blob/master/share/doc/homebrew/How-To-Open-a-Homebrew-Pull-Request-(and-get-it-merged).md
#

set -e -u -o pipefail

if [ "$#" -lt 1 ] ; then
	echo Usage: brew.sh VERSION
	echo VERSION should be something like 1.0.3
	exit 1
fi

version="$1"
version_branch="keybase-$version"
repo=$(brew --repository)

function onExit {
	cd "$repo"
	git checkout master
	git branch -D "$version_branch"
}
trap onExit EXIT


echo "Brew repository: $repo"
cd "$repo"
git checkout master
brew update
git checkout -b "$version_branch"
# this next step could be automated by copying the keybase.rb file from
# keybase/homebrew-beta repo:
brew edit keybase
brew audit keybase
brew tests
brew unlink keybase
brew install keybase
brew test keybase
git commit Library/Formula/keybase.rb
git push --set-upstream keybase "$version_branch"

open https://github.com/keybase/homebrew
