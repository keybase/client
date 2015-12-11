#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

./increment_build_keybase.sh auto
./keybase.sh
./desktop/package_darwin.sh
