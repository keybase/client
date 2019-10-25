#!/usr/bin/env bash
set -euox pipefail

whoami
yum install -y vim less curl sudo
if grep CentOS /etc/os-release; then
    yum groupinstall -y "X Window system"
else
    yum install -y @base-x
    yum install -y xorg-x11-xauth
    yum install -y nss-tools gtk3 alsa-lib
    echo "X11UseLocalhost No" >> /etc/ssh/sshd_config
    systemctl restart sshd
fi
yum install -y xorg-x11-apps
