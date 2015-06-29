#!/usr/bin/env bash

KBWEB_PORT="3000"
QUOTA_PORT="44003"
# use different names for the container and image, so docker inspect
# will be clear about when a container exists, rather than just the
# image
KBWEB_CONTAINER_NAME="kbweb$KBWEB_PORT"
KBWEB_IMAGE_NAME="kbweb"

function check_server() {
    timeout=$1
    tries=$2
    wget -O - --timeout=$timeout --tries=$tries localhost:$KBWEB_PORT > /dev/null 2>&1
}

# If there's already a server listening on port 3000, just use it
if check_server 1 1; then
    echo "Keybase server already running"
    exit 0
fi

# If docker's not running, bail out
# TODO: If not, launch the server from the command line?
if ! docker version > /dev/null 2>&1; then
    echo "No server running, and docker is unavailable"
    exit -1
fi

# Unpause a paused container, if possible
paused=`docker inspect --format='{{.State.Paused}}' $KBWEB_CONTAINER_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    if [ "$paused" = "true" ]; then
        set -e
        echo "Unpausing existing container"
        docker unpause $KBWEB_CONTAINER_NAME
        check_server 1 30
        exit 0
    fi
fi

# Start a stopped container, if possible
running=`docker inspect --format='{{.State.Running}}' $KBWEB_CONTAINER_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    if [ "$running" = "false" ]; then
        set -e
        echo "Starting existing container"
        docker start $KBWEB_CONTAINER_NAME
        check_server 1 30
        exit 0
    else
        # if it exists, but is already unpaused and running, then maybe it's
        # still in the process of launching; just wait
        echo "Using existing container"
        check_server 1 30
        exit 0
    fi
fi

# Otherwise, make sure we have a kbweb image, and launch a brand new container
image=`docker images $KBWEB_IMAGE_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    set -e
    echo "Launching new container"
    docker run -d -p $KBWEB_PORT:$KBWEB_PORT -p $QUOTA_PORT:$QUOTA_PORT -d --name=$KBWEB_CONTAINER_NAME $KBWEB_IMAGE_NAME
    check_server 1 30
    exit 0
fi

>&2 echo "Couldn't find or start the Keybase web server"
exit -1
