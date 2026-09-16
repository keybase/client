FROM rockylinux/rockylinux:10
LABEL maintainer="Keybase <admin@keybase.io>"

RUN dnf install -y fuse initscripts psmisc procps-ng lsof vim less curl sudo \
  && dnf clean all

RUN useradd -m kb -G wheel -s /bin/bash
RUN echo kb:pw | chpasswd
RUN echo "alias dlnightly='curl -O https://prerelease.keybase.io/nightly/keybase_amd64.rpm'\nalias dlrelease='curl -O https://prerelease.keybase.io/keybase_amd64.rpm'" >> /home/kb/.bashrc
