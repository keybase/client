#!/usr/bin/bash
set -euox pipefail
echo "Starting clearing linux smoketests"

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

for platform in */; do
    case $platform in
        vagrantcommon/) continue;;
    esac
    (
        cd "$platform"
        vagrant destroy -f
    )
done

echo "Finished clearing linux smoketests successfully"
