#!/usr/bin/bash
set -euox pipefail
echo "Starting linux smoketests"

for platform in ubuntu-stab*/; do
    case $platform in
        vagrantcommon/) continue;;
    esac
    echo "testing $platform"
    (
        cd "$platform"
        vagrant snapshot restore --no-start default
        vagrant up
        vagrant rsync
        set +e
        ssh -o "UserKnownHostsFile /dev/null" -o "StrictHostKeyChecking no" \
            -i .vagrant/machines/default/virtualbox/private_key \
            -Y -p "$(cat port)" vagrant@localhost <<EOF
                /vagrant/smoketest.bash
                exit
EOF
        ret=$?
        set -e
        if [ "$ret" != 0 ]; then
            echo "failed test for $platform"
        fi
        vagrant halt
        vagrant snapshot restore --no-start default
        if [ "$ret" != 0 ]; then
            exit 1
        fi
    )
done

echo "Finished linux smoketests successfully"
