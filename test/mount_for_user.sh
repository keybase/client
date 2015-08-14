#!/usr/bin/env bash

KBFS_TEST_DIR=$PWD/`dirname $0`

. $KBFS_TEST_DIR/test_common.sh

user=$1

. `user_env_file $user`
cd $KBFS_DATA
export KEYBASE_BSERVER_BIND_ADDR="localhost:$BSERV_PORT"
export KEYBASE_MDSERVER_BIND_ADDR="localhost:$MDSERV_PORT"
export KEYBASE_CA_CERT_PEM=`cat $CA_CERT`

mountpoint=`mount_name $user`

nohup $KBFS_TEST_DIR/../kbfsfuse/kbfsfuse -client -debug $mountpoint >> $KBFS_DATA/server$user.log 2>&1 &
cd -

