#!/usr/bin/env bash

. `dirname $0`/test_common.sh

function check_dynamo() {
    check_server $1 $2 $DYNAMO_PORT
}

# If there's already a bserver listening, just use it
if check_dynamo .2 1; then
    echo "Dynamo already running"
    exit 0
fi

iname=$DYNAMO_INSTANCE_NAME

check_docker_for_instance $iname
if [ $? -eq 0 ]; then
    check_dynamo 1 30
    exit 0
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

