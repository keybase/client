#!/usr/bin/env bash

# Rename everything osxfuse to kbfuse
# Run multiple times to workaround dir renames (TODO: Fix hack)
./rename.sh || ./rename.sh || ./rename.sh || ./rename.sh

# Undo rename of MOUNT_OSXFUSE_CALL_BY_LIB to MOUNT_KBFUSE_CALL_BY_LIB.
# MOUNT_OSXFUSE_CALL_BY_LIB is something we clear in bazil, and isn't configurable,
# so we revert the rename here. We'll have a better workaround in the future,
# either by allowing us to pass in env to bazil mount or if we use the new
# mount methods in OSXFuse 3.x.
files=("*.c" "*.h" "*.m")
for i in "${files[@]}"
do
  find . -name "$i" -type f -exec sed -i '' s/MOUNT_KBFUSE_CALL_BY_LIB/MOUNT_OSXFUSE_CALL_BY_LIB/g {} +
done
