#!/usr/bin/env bash

KBFS_TEST_DIR=$PWD/`dirname $0`

. $KBFS_TEST_DIR/test_common.sh

user=$1

unmount_user $user
