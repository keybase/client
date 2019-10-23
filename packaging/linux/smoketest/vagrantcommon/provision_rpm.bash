#!/usr/bin/env bash
set -euox pipefail

whoami
yum install -y at fuse libXScrnSaver.x86_64 initscripts psmisc procps lsof
yum install -y vim less curl sudo
yum install -y xfce4 xfce4-terminal
curl --remote-name https://prerelease.keybase.io/keybase_amd64.rpm
useradd -m kb -G sudo -s /bin/bash -p $(echo pw | openssl passwd -1 -stdin)
mv keybase_amd64.rpm /home/kb/keybase.rpm
