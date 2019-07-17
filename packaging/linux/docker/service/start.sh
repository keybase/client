#!/usr/bin/env bash

if [ "$#" -gt 1 ]; then
    bash -c "keybase ${KEYBASE_SERVICE_ARGS:-"-debug"} service &> /var/log/keybase/service.log" &
    bash -c "KEYBASE_DEBUG=1 kbfsfuse ${KEYBASE_KBFS_ARGS:-"-debug -mount-type=none"} &> /var/log/keybase/kbfs.log" &
else
    bash -c "keybase ${KEYBASE_SERVICE_ARGS:-"-debug"} service" &
    bash -c "KEYBASE_DEBUG=1 kbfsfuse ${KEYBASE_KBFS_ARGS:-"-debug -mount-type=none"}" &
fi

SERVICE_COUNTER=0
until keybase --no-auto-fork status &> /dev/null; do
    if [ $SERVICE_COUNTER -gt 10 ]; then
        echo "Service failed to start"
        exit 1
    fi
    ((SERVICE_COUNTER++))
    sleep 1
done

KBFS_COUNTER=0
until keybase --no-auto-fork fs ls /keybase/private &> /dev/null; do
    if [ $KBFS_COUNTER -gt 10 ]; then
        echo "Service failed to start"
        exit 1
    fi
    ((KBFS_COUNTER++))
    sleep 1
done

if [ "$#" -gt 1 ]; then
    $@ &
fi

wait -n
pkill -P $$
