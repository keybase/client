#!/usr/bin/env bash
# shellcheck disable=SC2086,SC2068
set -euo pipefail

# chown the data dirs if running as root, then rerun the script as keybase
if [[ "$(id -u)" -eq "0" ]]; then
    chown -R keybase:keybase \
        /home/keybase/.config/keybase \
        /home/keybase/.local/share/keybase
    exec gosu keybase ${BASH_SOURCE[0]} "$@"
    exit 0
fi

# If a command was passed and KEYBASE_SERVICE is not set, simply run the command
if [ "$#" -gt 0 ] && [ ! -v KEYBASE_SERVICE ]; then
    exec "$@"
    exit 0
fi

# If we're called with any args, don't pollute stdout and stderr and write the
# logs into /var/log/keybase.
KEYBASE_SERVICE_ARGS="${KEYBASE_SERVICE_ARGS:-"-debug"}"
KEYBASE_KBFS_ARGS="${KEYBASE_KBFS_ARGS:-"-debug -mount-type=none"}"
if [ "$#" -gt 0 ]; then
    keybase $KEYBASE_SERVICE_ARGS service &> /var/log/keybase/service.log &
    KEYBASE_DEBUG=1 kbfsfuse $KEYBASE_KBFS_ARGS &> /var/log/keybase/kbfs.log &
else
    keybase $KEYBASE_SERVICE_ARGS service &
    KEYBASE_DEBUG=1 kbfsfuse $KEYBASE_KBFS_ARGS &
fi

# Wait up to 10 seconds for the service to start
SERVICE_COUNTER=0
until keybase --no-auto-fork status &> /dev/null; do
    if [ $SERVICE_COUNTER -gt 10 ]; then
        echo "Service failed to start" >&2
        exit 1
    fi
    SERVICE_COUNTER=$((SERVICE_COUNTER + 1))
    sleep 1
done

# Wait up to 10 seconds for KBFS to start
KBFS_COUNTER=0
until keybase --no-auto-fork fs ls /keybase/private &> /dev/null; do
    if [ $KBFS_COUNTER -gt 10 ]; then
        echo "KBFS failed to start" >&2
        exit 1
    fi
    KBFS_COUNTER=$((KBFS_COUNTER + 1))
    sleep 1
done

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
