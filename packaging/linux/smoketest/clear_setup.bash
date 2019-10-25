#!/usr/bin/bash
set -euox pipefail
echo "Starting clearing linux smoketests"

for platform in */; do
    case $platform in
        vagrantcommon) continue;;
    esac
    (
        cd "$platform"
        vagrant destroy -f
    )
done

echo "Finished clearing linux smoketests successfully"
