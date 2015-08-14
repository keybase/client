#!/usr/bin/env bash

KBFS_TEST_DIR=$PWD/`dirname $0`

. $KBFS_TEST_DIR/test_common.sh

user=$1

reset_kbfs_env
. `user_env_file $user`
cd $KBFS_DATA
export KEYBASE_BSERVER_BIND_ADDR="localhost:$BSERV_PORT"
export KEYBASE_MDSERVER_BIND_ADDR="localhost:$MDSERV_PORT"
export KEYBASE_CA_CERT_PEM=`cat $CA_CERT`

nohup $KBFS_TEST_DIR/../kbfsfuse/kbfsfuse -client -debug $KBFS_MOUNT >> $KBFS_DATA/server$user.log 2>&1 &
cd -

