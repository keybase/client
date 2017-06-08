#!/usr/bin/env bash

#
# This is a script to install KBFuse fsbundle and load the kext.
# It is likely used by build or test machines since it requires
# root permissions. Our end users have this installed via a
# privileged helper tool in the Installer app.
#

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

client_dir="$dir/../.."
fuse_dir="$client_dir/osx/Fuse"
tmp_dir="/tmp/desktop-kbfuse"
installer_url="https://prerelease.keybase.io/darwin-package/KeybaseInstaller-1.1.56-darwin.tgz"

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

# Clear tmp
rm -rf "$tmp_dir"
mkdir -p "$tmp_dir"
cd "$tmp_dir"

echo "Downloading installer from $installer_url"
curl -J -L -Ss "$installer_url" | tar zx

echo "Installing KBFuse..."
bundle="$tmp_dir/KeybaseInstaller.app/Contents/Resources/kbfuse.bundle"
BUNDLE="$bundle" "$fuse_dir/install.sh"
