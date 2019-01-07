#!/bin/bash

[ $(find vendor/github.com/stellar -type f -print0 | sort -z | xargs -0 shasum | shasum | colrm 41) == "f3a7d9906dab5c481669b5b4f852bf447388bd3d" ] || echo "stellar vendor hash check failed"
