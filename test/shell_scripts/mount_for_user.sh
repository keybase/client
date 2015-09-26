#!/usr/bin/env bash

KBFS_TEST_DIR=$PWD/`dirname $0`

. $KBFS_TEST_DIR/test_common.sh

user=$1

. `user_env_file $user`
cd $KBFS_DATA
export KEYBASE_TEST_ROOT_CERT_PEM=`cat $CA_CERT`

mountpoint=`mount_name $user`

nohup $KBFS_TEST_DIR/../kbfsfuse/kbfsfuse -client -debug -bserver localhost:$BSERV_PORT -mdserver localhost:$MDSERV_PORT $mountpoint >> $KBFS_DATA/client$user.log 2>&1 &
cd -

