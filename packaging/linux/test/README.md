Debian/Ubuntu:
=======

To build a package for debian from a local branch in client (on amd64):

    cd $GOPATH/src/github.com/keybase/client/packaging/linux
    docker build -t keybase_packaging_v14 .
    mkdir /var/tmp/keybase_build_work
    docker run -v /var/tmp/keybase_build_work:/root -v $GOPATH/src/github.com/keybase/client:/CLIENT:ro -v $GOPATH/src/github.com/keybase/kbfs:/KBFS:ro  -e NOWAIT -ti keybase_packaging_v14 bash

Then, from inside the docker environment:

    cd /root
    git clone https://github.com/keybase/client.git client --reference /CLIENT
    git clone https://github.com/keybase/kbfs.git kbfs --reference /KBFS
    cd client
    git remote add localclient /CLIENT
    git checkout localclient/<NAME_OF_LOCAL_BRANCH_TO_TEST>
    KEYBASE_SKIP_32_BIT=1 packaging/linux/build_binaries.sh prerelease /root/build
    packaging/linux/deb/package_binaries.sh /root/build
    packaging/linux/rpm/package_binaries.sh /root/build
    exit

Now you can test it in a fresh ubuntu environment:

    docker pull ubuntu
    docker build -t keybase-ubuntu-test $GOPATH/src/github.com/keybase/client/packaging/linux/test/keybase-ubuntu-test
    docker run --privileged -v /var/tmp/keybase_build_work:/root -ti keybase-ubuntu-test bash

From inside the Ubuntu docker environment:

    cd /root/build/deb/amd64
    dpkg -i `ls -tr *.deb | tail -1`
    useradd -m strib
    su - strib
    run_keybase

To test an upgrade, start a different docker container:

    docker run --privileged -v /var/tmp/keybase_build_work:/root -ti keybase-ubuntu-test bash

Then inside it:

    cd /tmp/
    curl -O https://prerelease.keybase.io/keybase_amd64.deb
    dpkg -i keybase_amd64.deb
    useradd -m strib
    su - strib
    run_keybase

After that you can upgrade it:
    exit  # back to root
    cd /root/build/deb/amd64
    dpkg -i `ls -tr *.deb | tail -1`

Ubuntu with systemd:
=======

Systemd requires that the docker container be run as a daemon:

    docker pull solita/ubuntu-systemd
    docker build -t keybase-ubuntu-systemd-test $GOPATH/src/github.com/keybase/client/packaging/linux/test/keybase-ubuntu-systemd-test
    docker run --rm --privileged -v /:/host solita/ubuntu-systemd setup
    docker run -d --privileged -v /var/tmp/keybase_build_work:/root --security-opt seccomp:unconfined -v /sys/fs/cgroup:/sys/fs/cgroup:ro --tmpfs /run --tmpfs /run/lock --name systemd -ti keybase-ubuntu-systemd-test
    docker exec -ti systemd bash

Then inside the container you can use the same steps as above to
install and start keybase.

Centos:
========

    docker pull centos
    docker build -t keybase-centos-test $GOPATH/src/github.com/keybase/client/packaging/linux/test/keybase-centos-test
    docker run --privileged -v /var/tmp/keybase_build_work:/root -ti keybase-centos-test bash

From inside the Centos docker environment:

    cd /root/build/rpm/x86_64/RPMS/x86_64
    rpm -Uvh `ls -tr *.rpm | tail -1`

To test an upgrade, start a different docker container:

Then inside it:

    yum install https://prerelease.keybase.io/keybase_amd64.rpm
    useradd -m strib
    su - strib
    run_keybase

After that you can upgrade it:
    exit  # back to root
    cd /root/build/rpm/x86_64/RPMS/x86_64
    rpm -Uvh `ls -tr *.rpm | tail -1`

Arch:
=====

    docker pull base/archlinux
    docker build -t keybase-arch-test $GOPATH/src/github.com/keybase/client/packaging/linux/test/keybase-arch-test
    docker run --privileged -v /var/tmp/keybase_build_work:/root -ti keybase-arch-test bash

From inside the Arch docker environment:

    chmod a+rw /root/build
    useradd -m strib
    su - strib
    cd /root/client/packaging/linux/arch/
    ./build_test_package.sh /root/build
    exit  # back to root
    pacman -U --noconfirm  `ls -tr /root/build/arch/keybase-bin/*.xz | tail -1`
    su - strib
    run_keybase
