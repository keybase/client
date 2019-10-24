#!/usr/bin/bash
set -euox pipefail
echo "Starting setting up linux smoketests"

for platform in ubuntu-stab*; do
    case $platform in
        smoketest_all.bash) continue;;
        setup_smoketests.bash) continue;;
        vagrantcommon) continue;;
    esac
    (
        cd "$platform"
        vagrant up
        vagrant snapshot save default
        vagrant halt
    )
done

echo "Finished setting up linux smoketests successfully"
