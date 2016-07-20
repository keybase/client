#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

echo "Checking for mounts..."
mounts=`mount -t kbfuse`
if [[ $mounts = *[!\ ]* ]]; then
  echo "There are mounts, please unmount before uninstalling."
  echo "\t$mounts"
  exit 1
fi

echo "Unloading kext..."
sudo kextunload -b "com.github.kbfuse.filesystems.kbfuse"
echo "Removing bundle..."
sudo rm -rf "/Library/Filesystems/kbfuse.fs"
