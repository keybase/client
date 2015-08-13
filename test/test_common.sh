KBWEB_INSTANCE_NAME="kbweb3000"
KBDAEMON_IMAGE_NAME="kbdaemon"
KBDAEMON_SOCKET_NAME="keybase.sock"
KBFS_MOUNT="/tmp/kbfs"
KBFS_DATA="/tmp/kbfs_server"
BSERV_IMAGE_NAME="bserver"
BSERV_PORT=9999
BSERV_INSTANCE_NAME="bsrv$BSERV_PORT"

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

function user_env_file() {
    u=$1
    echo "/tmp/user$u.env"
}

function reset_kbfs_env() {
    fusermount -u $KBFS_MOUNT
    mkdir -p $KBFS_MOUNT
    mkdir -p $KBFS_DATA
}

function clean_kbfs_env() {
    reset_kbfs_env
    rm -rf $KBFS_DATA/*
}
