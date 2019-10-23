#!/usr/bin/env bash
set -euox pipefail

whoami
apt-get -y update
apt-get -y install curl sudo vim libappindicator1 fuse libgconf-2-4 psmisc procps lsof
apt-get -y install xfce4 xfce4-terminal
curl --remote-name https://prerelease.keybase.io/keybase_amd64.deb
useradd -m kb -G sudo -s /bin/bash -p $(echo pw | openssl passwd -1 -stdin)
mv keybase_amd64.deb /home/kb/keybase.deb
