#!/usr/bin/env bash

KBFS_TEST_DIR=$PWD/`dirname $0`

. $KBFS_TEST_DIR/test_common.sh

user=$1

reset_kbfs_env
. `user_env_file $user`
cd $KBFS_DATA
export KEYBASE_BSERVER_BIND_ADDR="localhost:$BSERV_PORT"
nohup $KBFS_TEST_DIR/../kbfsfuse/kbfsfuse -client -debug $KBFS_MOUNT >> $KBFS_DATA/server$user.log 2>&1 &
cd -

