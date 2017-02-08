#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

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

#
# Patch the MACOSX_ADMIN_GROUP_NAME
#
echo "Patching MACOSX_ADMIN_GROUP_NAME..."

grepadmin=`grep -E "#define\s+MACOSX_ADMIN_GROUP_NAME\s+\"admin\"" osxfuse/common/fuse_param.h`

if [ "$grepadmin" = "" ]; then
  echo "Unable to patch MACOSX_ADMIN_GROUP_NAME"
  exit 1
fi

sed -i '' -E 's/#define[[:space:]]+MACOSX_ADMIN_GROUP_NAME[[:space:]]+"admin"/#define MACOSX_ADMIN_GROUP_NAME         "staff"/' osxfuse/common/fuse_param.h
