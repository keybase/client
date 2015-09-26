KBWEB_INSTANCE_NAME="kbweb3000"
KBDAEMON_IMAGE_NAME="kbdaemon"
KBDAEMON_SOCKET_NAME="keybase.sock"
KBFS_MOUNT_PREFIX="/tmp/kbfs"
KBFS_DATA="/tmp/kbfs_data"
DYNAMO_IMAGE_NAME="dynamo"
DYNAMO_PORT=8000
DYNAMO_INSTANCE_NAME="dynamo$DYNAMO_PORT"
BSERV_IMAGE_NAME="bserver"
BSERV_PORT=9999
BSERV_INSTANCE_NAME="bsrv$BSERV_PORT"
MDSERV_IMAGE_NAME="mdserver"
MDSERV_PORT=9998
MDSERV_INSTANCE_NAME="md$MDSERV_PORT"

# keys
CA_PRIV_KEY=$KBFS_DATA/caprivkey.pem
CA_CERT=$KBFS_DATA/cacert.pem
CLIENT_CA_CERT=$KBFS_DATA/cert.pem

function socket_dir() {
    u=$1
    echo "/tmp/kbdaemon$u"
}

function instance_name() {
    u=$1
    echo "kbd$u"
}

function mount_name() {
    u=$1
    echo "$KBFS_MOUNT_PREFIX$u"
}

function user_env_file() {
    u=$1
    echo "/tmp/user$u.env"
}

function unmount_user() {
    u=$1
    mountpoint=`mount_name $u`
    fusermount -u $mountpoint
    mkdir -p $mountpoint
}

function reset_kbfs_env() {
    num_users=$1
    u=1
    while [ $u -le $num_users ]; do
        unmount_user $u
        u=$[u+1]
    done
    mkdir -p $KBFS_DATA
}

function clean_kbfs_env() {
    num_users=$1
    reset_kbfs_env $num_users
    rm -rf $KBFS_DATA/*
}

function check_server() {
    timeout=$1
    tries=$2
    port=$3
    while [ $tries -gt 0 ]; do
        timeout "$timeout"s telnet 127.0.0.1 $port > /dev/null 2>&1
        rt=$?
        if [ $rt -eq 124 ]; then
            # This is a timeout error, which means we were actually
            # able to connect
            break
        else
            tries=$[tries-1]
            sleep $timeout
        fi
    done
    [ $tries -ne 0 ]
}

function check_docker_for_instance() {
    iname=$1

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
            return 0
        fi
    fi

    # Start a stopped container, if possible
    running=`docker inspect --format='{{.State.Running}}' $iname 2> /dev/null`
    if [ $? -eq 0 ]; then
        if [ "$running" = "false" ]; then
            set -e
            echo "Starting existing container"
            docker start $iname
            return 0
        else
            set -e
            # if it exists, but is already unpaused and running, then maybe it's
            # still in the process of launching; just wait
            echo "Using existing container"
            check_bserver 1 30
            return 0
        fi
    fi

    return 1
}
