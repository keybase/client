#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

client_dir="$dir/../.."
fuse_dir="$client_dir/osx/Fuse"
tmp_dir="/tmp/desktop-kbfuse"
installer_url="https://github.com/keybase/client/releases/download/v1.0.16/KeybaseInstaller-1.1.32-darwin.tgz"

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
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
