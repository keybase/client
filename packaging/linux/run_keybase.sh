#!/bin/bash

set -u -o pipefail

# Stop any existing services. These commands may return errors depending on
# what's running/installed, so we don't use `set -e` above.
fusermount -uz /keybase
killall kbfsfuse
killall Keybase
killall keybase

KEYBASE_RUN_MODE=prod keybase service &>/dev/null &
KEYBASE_RUN_MODE=prod kbfsfuse -mdserver mdserver.kbfs.keybase.io:443 -bserver bserver.kbfs.keybase.io:443 /keybase &>/dev/null &
KEYBASE_RUN_MODE=prod /opt/keybase/Keybase &>/dev/null &
