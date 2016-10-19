#!/usr/bin/env bash

# If you ever update this script you should manually git pull on the
# build machines since this script may live inside the repo that is
# being pulled. This script is only meant to be a wrapper around
# pulling and building so it won't need to be changed often.

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

client_dir="$GOPATH/src/github.com/keybase/client"
nopull=${NOPULL:-} # Don't git pull
if [ ! "$nopull" = "1" ]; then
  "$client_dir/packaging/check_status_and_pull.sh" "$client_dir"
fi

./build_app.sh
