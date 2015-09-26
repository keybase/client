#!/usr/bin/env bash

KEYBASE_CLIENT_ROOT=$GOPATH/src/github.com/keybase/client/go
KBFS_TEST_DIR=$PWD/`dirname $0`

. $KBFS_TEST_DIR/test_common.sh

num_users=$1

if [ -z "$num_users" ]; then
    echo "You need to specify num_users."
    exit -1
fi

clean_kbfs_env $num_users

# shutdown mdserver
docker rm -f $MDSERV_INSTANCE_NAME

# shutdown bserver
docker rm -f $BSERV_INSTANCE_NAME

# shutdown dynamo
docker rm -f $DYNAMO_INSTANCE_NAME

u=1
while [ $u -le $num_users ]; do
    docker rm -f `instance_name $u`
    rm -f `user_env_file $u`
    u=$[u+1]
done

# pause kbweb
docker pause $KBWEB_INSTANCE_NAME
