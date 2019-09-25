#!/usr/bin/env bash
# shellcheck disable=SC2086,SC2068
set -euxo pipefail

# If a command was passed and KEYBASE_SERVICE is not set, simply run the command
if [ "$#" -gt 1 ] -a [[ -z "${KEYBASE_SERVICE}" ]]; then
    exec "$@"
    exit 0
fi

# If we're called with any args, don't pollute stdout and stderr and write the
# logs into /var/log/keybase
if [ "$#" -gt 1 ]; then
    keybase ${KEYBASE_SERVICE_ARGS:-"-debug"} service &> /var/log/keybase/service.log &
else
    keybase ${KEYBASE_SERVICE_ARGS:-"-debug"} service &
fi

# Wait up to 10 seconds for the service to start
SERVICE_COUNTER=0
until keybase --no-auto-fork status &> /dev/null; do
    if [ $SERVICE_COUNTER -gt 10 ]; then
        echo "Service failed to start" >&2
        exit 1
    fi
    ((SERVICE_COUNTER++))
    sleep 1
done

# Possibly run oneshot if it was requested by the user
if [[ -v KEYBASE_USERNAME ]] -a [[ -v KEYBASE_PAPERKEY ]]; then
    keybase --no-auto-fork oneshot
fi

# Run the main command in foreground if one was passed
if [ "$#" -gt 1 ]; then
    $@ &
fi

wait -n
pkill -P $$
