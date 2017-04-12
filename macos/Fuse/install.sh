#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

bundle=${BUNDLE:-"kbfuse.bundle"}
dest="/Library/Filesystems/kbfuse.fs"

echo "Using bundle: $bundle"

# Uninstall if present. This will fail if there are current kbfuse mounts.
if [ -d "$dest" ]; then
  echo "Uninstalling $dest..."
  "$dir/uninstall.sh"
fi

echo "Installing $dest..."
sudo /bin/cp -RfX "$bundle" "$dest"
sudo chmod +s "/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse"
echo "Loading kext..."
/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse

kextstat | grep kbfuse
