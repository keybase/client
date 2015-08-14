#!/usr/bin/env bash

. `dirname $0`/test_common.sh

function check_dynamo() {
    timeout=$1
    tries=$2
    expected_err=$3
    while [ $tries -gt 0 ]; do
        timeout "$timeout"s telnet 127.0.0.1 $DYNAMO_PORT > /dev/null 2>&1
        rt=$?
        if [ $rt -eq 124 ]; then
            # This is a timeout error, which means we were actually
            # able to connect
            break
        else
            tries=$[tries-1]
            sleep $timeout
        fi
    done
    [ $tries -ne 0 ]
}

# If there's already a bserver listening, just use it
if check_dynamo .2 1; then
    echo "Dynamo already running"
    exit 0
fi

iname=$DYNAMO_INSTANCE_NAME

# If docker's not running, bail out
# TODO: If not, launch the server from the command line?
if ! docker version > /dev/null 2>&1; then
    echo "No server running, and docker is unavailable"
    exit -1
fi

# Unpause a paused container, if possible
paused=`docker inspect --format='{{.State.Paused}}' $iname 2> /dev/null`
if [ $? -eq 0 ]; then
    if [ "$paused" = "true" ]; then
        set -e
        echo "Unpausing existing container"
        docker unpause $iname
        check_dynamo 1 30
        exit 0
    fi
fi

# Start a stopped container, if possible
running=`docker inspect --format='{{.State.Running}}' $iname 2> /dev/null`
if [ $? -eq 0 ]; then
    if [ "$running" = "false" ]; then
        set -e
        echo "Starting existing container"
        docker start $iname
        check_dynamo 1 30
        exit 0
    else
        set -e
        # if it exists, but is already unpaused and running, then maybe it's
        # still in the process of launching; just wait
        echo "Using existing container"
        check_dynamo 1 30
        exit 0
    fi
fi

# Otherwise, make sure we have a bsrv image, and launch a brand new container
image=`docker images $DYNAMO_IMAGE_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    set -e
    echo "Launching new dynamo container"
    docker run -d --name $iname -p $DYNAMO_PORT:$DYNAMO_PORT $DYNAMO_IMAGE_NAME
    check_dynamo 1 30 ""
    exit 0
fi

>&2 echo "Couldn't find or start the dynamo server"
exit -1

