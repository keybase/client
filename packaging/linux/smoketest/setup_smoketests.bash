#!/usr/bin/bash
set -euox pipefail
echo "Starting setting up linux smoketests"

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

vagrant plugin install vagrant-vbguest

for platform in */; do
    case $platform in
        vagrantcommon/) continue;;
    esac
    (
        cd "$platform"
        vagrant up --provision
        vagrant snapshot save --force default
        vagrant halt
    )
done

echo "Finished setting up linux smoketests successfully"
