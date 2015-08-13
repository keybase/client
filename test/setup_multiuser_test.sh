#!/usr/bin/env bash

KEYBASE_CLIENT_ROOT=$GOPATH/src/github.com/keybase/client/go
KBFS_TEST_DIR=$PWD/`dirname $0`

. $KBFS_TEST_DIR/test_common.sh

num_users=$1

# First start the webserver
$KEYBASE_CLIENT_ROOT/test/check_or_start_kbweb.sh

# Then start multiple daemons and save the environment from each
u=1
cmds=""
userfile=`tempfile`
while [ $u -le $num_users ] ; do
    env=`$KBFS_TEST_DIR/launch_daemon_for_new_user.sh $u | grep export`
    if [ -z "$env" ]; then
        echo "Environment for user $u already exists"
        u=$[u+1]
        continue
    fi
    eval $env
    if [ -z "$KEYBASE_SOCKET_FILE" ]; then
        KEYBASE_SOCKET_FILE="\"\""
    fi
    envfile=`user_env_file $u`
    cmds="$cmds write_user_env $KEYBASE_SOCKET_FILE $KBUSER $envfile;"
    echo "export KBUSER$u=$KBUSER" >> $userfile
    u=$[u+1]
done

function write_user_env() {
    sock=$1
    user=$2
    file=$3
cat >$file <<EOF
export KEYBASE_SOCKET_FILE=$sock
export KBUSER=$user
EOF
cat $userfile >> $file
}

eval $cmds
rm $userfile
clean_kbfs_env

# generate new ssl keys
# first, the server CA private key:
openssl genrsa -out $CA_PRIV_KEY
# then cacert
openssl req -subj /CN=localhost -batch -new -x509 -key $CA_PRIV_KEY -out $CA_CERT -days 1095
# the client's CA cert is in a different file
cp $CA_CERT $CLIENT_CA_CERT

# start bserver
./launch_bserver.sh

