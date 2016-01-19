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

KEYBASE_RUN_MODE=prod keybase service &>> "$logdir/keybase.service.log" &
KEYBASE_RUN_MODE=prod kbfsfuse -mdserver mdserver.kbfs.keybase.io:443 \
  -bserver bserver.kbfs.keybase.io:443 /keybase &>> "$logdir/keybase.kbfs.log" &
KEYBASE_RUN_MODE=prod /opt/keybase/Keybase &>> "$logdir/keybase.gui.log" &
