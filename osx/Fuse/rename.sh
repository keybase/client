#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

cd macfuse

files=("*.c" "*.h" "*.m" "*Info.plist" "*version.plist" "*.pbxproj" "*.sh" "*.am" "*.ac" "*.d" "*.in")
for i in "${files[@]}"
do
echo "Files: $i"
find . -name "$i" -type f
find . -name "$i" -type f -exec sed -i '' s/osxfuse/kbfuse/g {} +
find . -name "$i" -type f -exec sed -i '' s/OSXFUSE/KBFUSE/g {} +
find . -name "$i" -type f -exec sed -i '' s/macfuse/kbfuse/g {} +
find . -name "$i" -type f -exec sed -i '' s/MACFUSE/KBFUSE/g {} +
find . -name "$i" -type f -exec sed -i '' "s/io\.kbfuse\.filesystems\.kbfuse/com.github.kbfuse.filesystems.kbfuse/g" {} +
find . -name "$i" -type f -exec sed -i '' "s/io\.kbfuse\.filesystems\.fs\.kbfuse/com.github.kbfuse.filesystems.kbfuse/g" {} +
find . -name "$i" -type f -exec sed -i '' s/io\.kbfuse/com.github.kbfuse/g {} +
done

find . -type d -name '*macfuse*' -exec sh -c 'mv {} $(echo {} | sed -e 's/macfuse/kbfuse/g')' \;
find . -name '*macfuse*' -exec sh -c 'mv {} $(echo {} | sed -e 's/macfuse/kbfuse/g')' \; || true

echo "OK"

cd ..
