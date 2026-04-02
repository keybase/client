#!/usr/bin/env bash

#
# This script stages the Keybase FSKit filesystem module from the native
# installer bundle into /Library/Filesystems for CI/build hosts.
#

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

tmp_dir="/tmp/desktop-fskit"
# TODO build and publish arm64 version
installer_url="https://prerelease.keybase.io/darwin-package/KeybaseInstaller-1.1.94-darwin.tgz"

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

rm -rf "$tmp_dir"
mkdir -p "$tmp_dir"
cd "$tmp_dir"

echo "Downloading installer from $installer_url"
curl -J -L -Ss "$installer_url" | tar zx

echo "Installing FSKit module..."
bundle="$tmp_dir/KeybaseInstaller.app/Contents/Resources/keybase.fs"
dest="/Library/Filesystems/keybase.fs"
rm -rf "$dest"
cp -R "$bundle" "$dest"
