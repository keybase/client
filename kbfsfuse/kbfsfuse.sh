#!/bin/bash

_term() {
    echo "Caught TERM signal"
    kill -TERM "$SERVICE"
    kill -TERM "$KBFS"
    exit 0
}
trap _term SIGTERM

if [ -z "$KEYBASE_TEST_ROOT_CERT_PEM" ]; then
    export KEYBASE_TEST_ROOT_CERT_PEM="$(echo $KEYBASE_TEST_ROOT_CERT_PEM_B64 | base64 -d)";
fi

if [ -f kbfs_revision ]; then
    echo "Running KBFS Docker with KBFS revision $(cat kbfs_revision)"
fi
if [ -f client_revision ]; then
    echo "Client revision $(cat client_revision)"
fi

keybase service &
SERVICE=$!
KEYBASE_DEBUG=1 kbfsfuse -debug -mdserver $MDSERVER_ADDR -bserver $BSERVER_ADDR -log-to-file /keybase &
KBFS=$!

wait "$SERVICE"
wait "$KBFS"
