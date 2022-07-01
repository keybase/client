#!/usr/bin/env bash
set -euox pipefail

whoami
apt-get -y update
apt-get -y install curl sudo vim
apt-get -y install xinit x11-apps
