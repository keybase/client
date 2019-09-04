FROM centos
MAINTAINER Keybase <admin@keybase.io>

# Install dependencies for keybase
RUN yum install -y at fuse libXScrnSaver.x86_64 initscripts psmisc procps lsof

# Nice to have
RUN yum install -y vim less curl sudo

run useradd -m kb -G wheel -s /bin/bash
run echo kb:pw | chpasswd
run echo -e "alias dlnightly='curl -O https://prerelease.keybase.io/nightly/keybase_amd64.rpm'\nalias dlrelease='curl -O https://prerelease.keybase.io/keybase_amd64.rpm'" >> /home/kb/.bashrc
