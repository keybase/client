#!/bin/bash

echo "reinstalling gvm"
bash < <(curl -s -S -L https://raw.githubusercontent.com/moovweb/gvm/master/binscripts/gvm-installer)
gvm update 
gvm install go1.17.3 -B 
gvm use go1.17.3 --default
