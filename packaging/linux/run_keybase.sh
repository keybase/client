#!/bin/bash

set -u -o pipefail

# Stop any existing services. These commands may return errors depending on
# what's running/installed, so we don't use `set -e` above.
fusermount -uz /keybase
killall kbfsfuse
killall Keybase
killall keybase

logdir="${XDG_CACHE_HOME:-$HOME/.cache}/keybase"
mkdir -p "$logdir"

export KEYBASE_RUN_MODE=prod
export KEYBASE_DEBUG=1

keybase service &>> "$logdir/keybase.log" &
kbfsfuse -debug -mdserver mdserver.kbfs.keybase.io:443 \
  -bserver bserver.kbfs.keybase.io:443 /keybase &>> "$logdir/keybase.kbfs.log" &
/opt/keybase/Keybase &>> "$logdir/keybase.gui.log" &
