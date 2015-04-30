#!/usr/bin/env bash

. `dirname $0`/test_common.sh

usernum=$1

iname=`instance_name $usernum`
sdir=`socket_dir $usernum`
socket="$sdir/$KBDAEMON_SOCKET_NAME"

function check_daemon() {
    timeout=$1
    tries=$2
    expected_err=$3
    while [ $tries -gt 0 ]; do
        if KEYBASE_SOCKET_FILE=$socket timeout "$timeout"s $GOPATH/bin/client status > /dev/null 2>&1 ; then
            break
        else
            if [ -n "$expected_err" ]; then
                output=`KEYBASE_SOCKET_FILE=$socket timeout "$timeout"s $GOPATH/bin/client status 2>&1 || true`
                if echo $output | grep "$expected_err"; then
                    # ok, this is expected
                    break
                fi
            fi
            tries=$[tries-1]
            sleep $timeout
        fi
    done
    [ $tries -ne 0 ]
}

function print_env() {
    user=$1
    echo "export KEYBASE_SOCKET_FILE=$socket"
    echo "export KBUSER=$user"
}

# If there's already a daemon listening, just use it
if check_daemon .2 1; then
    echo "Keybase daemon already running"
    exit 0
fi

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
        check_daemon 1 30
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
        check_daemon 1 30
        exit 0
    else
        set -e
        # if it exists, but is already unpaused and running, then maybe it's
        # still in the process of launching; just wait
        echo "Using existing container"
        check_daemon 1 30
        exit 0
    fi
fi

# Otherwise, make sure we have a kbweb image, and launch a brand new container
image=`docker images $KBDAEMON_IMAGE_NAME 2> /dev/null`
if [ $? -eq 0 ]; then
    set -e
    echo "Launching new container"
    mkdir -p $sdir
    rm -rf $sdir/*
    docker run -d -v $GOPATH/bin:/keybase/bin -v $sdir:/keybase/socket --name $iname --link $KBWEB_INSTANCE_NAME:kbweb $KBDAEMON_IMAGE_NAME
    check_daemon 1 30 "Not logged in"
    user="u$usernum""_$RANDOM"
    docker exec $iname client signup --username $user --email $user@email.com --passphrase pass$user --device fakedevice -c 202020202020202020202020 --batch
    check_daemon 1 30
    echo $user
    print_env $user
    exit 0
fi

>&2 echo "Couldn't find or start the Keybase daemon"
exit -1


