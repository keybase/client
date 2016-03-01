#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

bundle=${BUNDLE:-"kbfuse.bundle"}

echo "Using bundle: $bundle"

sudo /bin/cp -RfX $bundle /Library/Filesystems/kbfuse.fs
sudo chmod +s /Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse
/Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse

kextstat | grep kbfuse
