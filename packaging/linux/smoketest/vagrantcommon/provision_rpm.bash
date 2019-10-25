#!/usr/bin/env bash
set -euox pipefail

whoami
yum install -y vim less curl sudo
yum install -y @base-x
yum install -y xorg-x11-apps
