#!/bin/bash
set -e -u

export GO15VENDOREXPERIMENT=1
cd shared
npm i --global flow-bin@`tail -n1 .flowconfig`
flow
cd ../protocol
npm i
gem install --user-install activesupport
make clean
make
git diff --quiet --exit-code 
cd ../go/keybase
go build
