#!/usr/bin/env bash
set -euox pipefail

whoami
yum install -y vim less curl sudo
yum groupinstall "X Window system"
yum install xorg-x11-apps
