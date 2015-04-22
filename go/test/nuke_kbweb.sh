#!/usr/bin/env bash

KBWEB_PORT="3000"
KBWEB_CONTAINER_NAME="kbweb$KBWEB_PORT"

# if it's paused, we have to unpause it first
paused=`docker inspect --format='{{.State.Paused}}' $KBWEB_CONTAINER_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    if [ "$paused" = "true" ]; then
        set -e
        docker unpause $KBWEB_CONTAINER_NAME
        set +e
    fi
fi


# if the Keybase webserver is running in a container, pause it
running=`docker inspect $KBWEB_CONTAINER_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    set -e
    docker rm -f $KBWEB_CONTAINER_NAME
fi
