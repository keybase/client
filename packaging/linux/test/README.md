Debian/Ubuntu:
=======

To build a package for debian from a local branch in client (on amd64):

    cd $GOPATH/src/github.com/keybase/client/packaging/linux
    # Run the following on Arch: see https://github.com/docker/for-linux/issues/480
    # echo N | sudo tee /sys/module/overlay/parameters/metacopy
    docker build -t keybase_packaging_v{**SEE NUMBER IN client/packaging/linux/docker_build.sh**} .
    mkdir /var/tmp/keybase_build_work
    docker run -v /var/tmp/keybase_build_work:/root -v $GOPATH/src/github.com/keybase/client:/CLIENT:ro -v $GOPATH/src/github.com/keybase/client/go/kbfs:/KBFS:ro  -e NOWAIT -ti keybase_packaging_v{**FILL IN ABOVE NUMBER HERE**} bash

Then, from inside the docker environment:

    cd /root
    git clone https://github.com/keybase/client.git client --reference /CLIENT
    git clone https://github.com/keybase/client/go/kbfs.git kbfs --reference /KBFS
    cd client
    git remote add localclient /CLIENT
    git fetch localclient
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

##### Local repo

If you want to try upgrading with `apt-get`, you need to edit the apt list.
Note that reinstalling will overwrite this change unless you `sudo touch
/etc/default/keybase` first. Note that for this to work, you need to run
`packaging/linux/deb/layout_repo.sh /root/build` to create the repo (and
comment out codesigning while testing). You also need to `rm -r /root/build/deb
/root/build/deb_repo` in between `layout_repo`s.

```
# before
root@813a2fbff4a5:/# cat /etc/apt/sources.list.d/keybase.list
### THIS FILE IS AUTOMATICALLY CONFIGURED ###
# You may comment out this entry, but any other modifications may be lost.
deb http://prerelease.keybase.io/deb stable main

# after
joot@813a2fbff4a5:/# cat /etc/apt/sources.list.d/keybase.list
### THIS FILE IS AUTOMATICALLY CONFIGURED ###
# You may comment out this entry, but any other modifications may be lost.
deb [trusted=yes] file:/root/build/deb_repo/repo stable main

root@813a2fbff4a5:/# apt-get update
root@813a2fbff4a5:/# apt-get upgrade keybase
...
The following packages will be upgraded:
  keybase
```

Ubuntu with systemd:
=======

Systemd requires that the docker container be run as a daemon:

    docker pull solita/ubuntu-systemd
    docker build -t keybase-ubuntu-systemd-test $GOPATH/src/github.com/keybase/client/packaging/linux/test/keybase-ubuntu-systemd-test
    docker run --rm --privileged -v /:/host solita/ubuntu-systemd setup
    docker run -d --privileged -v /var/tmp/keybase_build_work:/root --security-opt seccomp:unconfined -v /sys/fs/cgroup:/sys/fs/cgroup:ro --tmpfs /run --tmpfs /run/lock --name systemd -ti keybase-ubuntu-systemd-test
    docker exec -ti systemd bash

Then inside the container you can use the same steps as above to
install and start keybase. Instead of `su`, you may need to `login <user>`
so the systemd pam config runs.

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

##### Local repo

The process is similar as in Debian.

```
# before
bash-4.2# cat /etc/yum.repos.d/keybase.repo
[keybase]
name=keybase
baseurl=http://prerelease.keybase.io/rpm/x86_64
enabled=1
gpgcheck=1
gpgkey=https://keybase.io/docs/server_security/code_signing_key.asc
metadata_expire=60

# after
bash-4.2# cat /etc/yum.repos.d/keybase.repo
[keybase]
name=keybase
baseurl=file:///root/build/rpm_repo/repo/x86_64/
enabled=1
metadata_expire=60

# nogpgcheck needed in test
bash-4.2# yum update keybase --nogpgcheck
Loaded plugins: fastestmirror, ovl
Loading mirror speeds from cached hostfile
 * base: mirror.jaleco.com
 * extras: mirror.atlanticmetro.net
 * updates: mirror.metrocast.net
keybase
Resolving Dependencies
--> Running transaction check
---> Package keybase.x86_64 0:2.11.0.20181204152506.f11f4191e3-1 will be updated
bash-4.2#
```

Note that reinstalling will overwrite this change unless you `sudo touch
/etc/default/keybase` first. Note that for this to work, you need to run
`packaging/linux/rpm/layout_repo.sh /root/build` to create the repo (and
comment out codesigning while testing). You also need to `rm -r /root/build/rpm
/root/build/rpm_repo` in between `layout_repo`s.

Centos with systemd:
=======
You can use the Dockerfile at https://github.com/xrowgmbh/docker-systemd-example-httpd, but note that centos
doesn't support systemd user services right now, so Keybase will be using background anyway.

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
