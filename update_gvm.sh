#!/bin/bash

set -euox pipefail

echo "reinstalling gvm"
rm -rf /home/jenkins/.gvm # nuke old install
bash < <(curl -s -S -L https://raw.githubusercontent.com/moovweb/gvm/master/binscripts/gvm-installer)
source /home/jenkins/.gvm/scripts/gvm
gvm install go1.17.3 -B 
gvm use go1.17.3 --default
