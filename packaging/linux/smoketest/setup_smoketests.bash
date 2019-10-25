#!/usr/bin/bash
set -euox pipefail
echo "Starting setting up linux smoketests"

for platform in */; do
    case $platform in
        vagrantcommon) continue;;
    esac
    (
        cd "$platform"
        # vagrant destroy -f
        # vagrant plugin install vagrant-vbguest
        vagrant up
        vagrant snapshot save --force default
        vagrant halt
    )
done

echo "Finished setting up linux smoketests successfully"
