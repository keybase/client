#!/usr/bin/env bash

. `dirname $0`/test_common.sh

function check_mdserver() {
    check_server $1 $2 $MDSERV_PORT
}

# The bserver needs to be authenticated as some user. For now, use user 1
iname=$MDSERV_INSTANCE_NAME

# If there's already an mdserver listening, just use it
if check_mdserver .2 1; then
    echo "KBFS mdserver already running"
    exit 0
fi

check_docker_for_instance $iname
if [ $? -eq 0 ]; then
    check_mdserver 1 30
    exit 0
fi

# Otherwise, make sure we have a bsrv image, and launch a brand new container
image=`docker images $MDSERV_IMAGE_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    set -e
    echo "Launching new mdserver container"
    docker run -d -v $GOPATH/bin:/keybase/bin -v $CA_PRIV_KEY:/home/keybase/key.pem -v $CA_CERT:/home/keybase/cert.pem --name $iname --link $KBWEB_INSTANCE_NAME:kbweb --link $DYNAMO_INSTANCE_NAME:dynamo -e "MDSERV_PORT=$MDSERV_PORT" -p $MDSERV_PORT:$MDSERV_PORT $MDSERV_IMAGE_NAME
    check_mdserver 1 30 ""
    exit 0
fi

>&2 echo "Couldn't find or start the KBFS mdserver"
exit -1

