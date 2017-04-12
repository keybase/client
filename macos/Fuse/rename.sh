#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

cd osxfuse

files=("*.c" "*.h" "*.m" "*Info.plist" "*version.plist" "*.pbxproj" "*.sh" "*.am" "*.ac" "*.d" "*.in")
for i in "${files[@]}"
do
echo "Files: $i"
find . -name "$i" -type f
find . -name "$i" -type f -exec sed -i '' s/osxfuse/kbfuse/g {} +
find . -name "$i" -type f -exec sed -i '' s/OSXFUSE/KBFUSE/g {} +
done

find . -type d -name '*osxfuse*' -exec sh -c 'mv {} $(echo {} | sed -e 's/osxfuse/kbfuse/g')' \;
find . -name '*osxfuse*' -exec sh -c 'mv {} $(echo {} | sed -e 's/osxfuse/kbfuse/g')' \; || true

echo "OK"

cd ..
