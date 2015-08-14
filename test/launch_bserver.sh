#!/usr/bin/env bash

. `dirname $0`/test_common.sh

function check_bserver() {
    check_server $1 $2 $BSERV_PORT
}

# The bserver needs to be authenticated as some user. For now, use user 1
iname=$BSERV_INSTANCE_NAME
sdir=`socket_dir 1`
socket="$sdir/$KBDAEMON_SOCKET_NAME"

SECRET_FILE=`dirname $0`/secrets
SECRET_FILE=`readlink -f $SECRET_FILE`
if [ ! -f $SECRET_FILE ]; then
    echo "No secrets file at $SECRET_FILE.  Ask someone how to make this."
    exit -1
fi

# If there's already a bserver listening, just use it
if check_bserver .2 1; then
    echo "KBFS bserver already running"
    exit 0
fi

check_docker_for_instance $iname
if [ $? -eq 0 ]; then
    check_bserver 1 30
    exit 0
fi

# Otherwise, make sure we have a bsrv image, and launch a brand new container
image=`docker images $BSERV_IMAGE_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    set -e
    echo "Launching new bserver container"
    docker run -d -v $GOPATH/bin:/keybase/bin -v $sdir:/keybase/socket -v $CA_PRIV_KEY:/home/keybase/key.pem -v $CA_CERT:/home/keybase/cert.pem -v $SECRET_FILE:/home/keybase/secrets --name $iname --link $KBWEB_INSTANCE_NAME:kbweb --link $DYNAMO_INSTANCE_NAME:dynamo -p $BSERV_PORT:$BSERV_PORT $BSERV_IMAGE_NAME
    check_bserver 1 30 ""
    exit 0
fi

>&2 echo "Couldn't find or start the KBFS bserver"
exit -1

