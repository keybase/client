#!/usr/bin/bash
set -euox pipefail
echo "Starting linux smoketests"

parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

versionstring=$1
version=$(echo "$versionstring" | cut -d'-' -f1)
datetime=$(echo "$versionstring" | cut -d'-' -f2 | cut -d'+' -f1)
revision=$(echo "$versionstring" | cut -d'+' -f2)

# Make sure binaries are built so we can download them in tests
curl --output /dev/null --silent --head --fail "https://s3.amazonaws.com/tests.keybase.io/linux_binaries/deb/keybase_${version}-${datetime}.${revision}_amd64.deb"
curl --output /dev/null --silent --head --fail "https://s3.amazonaws.com/tests.keybase.io/linux_binaries/rpm/keybase-${version}.${datetime}.${revision}-1.x86_64.rpm"

for platform in */; do
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
        # we want EOF to be interpreted clientside
        # shellcheck disable=SC2087
        ssh -o "UserKnownHostsFile /dev/null" -o "StrictHostKeyChecking no" -i .vagrant/machines/default/virtualbox/private_key -Y -p "$(cat port)" vagrant@localhost <<EOF
                /vagrant/smoketest.bash "$version" "$datetime" "$revision"
                exit
EOF
        ret=$?
        set -e
        vagrant halt
        if [ "$ret" != 0 ]; then
            echo "failed test for $platform; not restoring vm to default state"
        else
            echo "passed test for $platform; restoring vm to default state"
            vagrant snapshot restore --no-start default
        fi
        if [ "$ret" != 0 ]; then
            exit 1
        fi
    )
done

echo "Finished linux smoketests successfully"
