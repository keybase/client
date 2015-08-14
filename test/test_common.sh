KBWEB_INSTANCE_NAME="kbweb3000"
KBDAEMON_IMAGE_NAME="kbdaemon"
KBDAEMON_SOCKET_NAME="keybase.sock"
KBFS_MOUNT_PREFIX="/tmp/kbfs"
KBFS_DATA="/tmp/kbfs_server"
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
