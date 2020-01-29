#!/usr/bin/env bash
# shellcheck disable=SC2086,SC2068
set -euo pipefail

# chown the data dirs if running as root, then rerun the script as keybase
if [[ "$(id -u)" -eq "0" ]]; then
    chown -R keybase:keybase \
        /home/keybase/.config/keybase \
        /home/keybase/.cache/keybase
    exec gosu keybase ${BASH_SOURCE[0]} "$@"
    exit 0
fi

# If a command was passed and KEYBASE_SERVICE is not set, simply run the command
if [ "$#" -gt 0 ] && [ ! -v KEYBASE_SERVICE ]; then
    exec "$@"
    exit 0
fi

KEYBASE_SERVICE_ARGS="${KEYBASE_SERVICE_ARGS:-"-debug -use-default-log-file"}"
KEYBASE_KBFS_ARGS="${KEYBASE_KBFS_ARGS:-"-debug -mount-type=none -log-to-file"}"
keybase $KEYBASE_SERVICE_ARGS service &
KEYBASE_DEBUG=1 kbfsfuse $KEYBASE_KBFS_ARGS &

# Wait up to 10 seconds each for both the service and KBFS to start
keybase ctl wait --include-kbfs

# Possibly run oneshot if it was requested by the user
if [ -v KEYBASE_USERNAME ] && [ -v KEYBASE_PAPERKEY ]; then
    keybase --no-auto-fork --no-debug oneshot
fi

# Run the main command in foreground if one was passed
if [ "$#" -gt 0 ]; then
    $@
    exit 0
fi

wait -n
pkill -P $$
