#!/usr/bin/env bash

KBWEB_PORT="3000"
KBWEB_CONTAINER_NAME="kbweb$KBWEB_PORT"

# if the Keybase webserver is running in a container, pause it
running=`docker inspect --format='{{.State.Running}}{{.State.Paused}}' $KBWEB_CONTAINER_NAME 2> /dev/null`
if [ $running = "truefalse" ]; then
    set -e
    docker pause $KBWEB_CONTAINER_NAME
fi
