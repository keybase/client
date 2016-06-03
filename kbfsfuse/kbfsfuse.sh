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

keybase service &
SERVICE=$!
kbfsfuse -debug -mdserver $MDSERVER_ADDR -bserver $BSERVER_ADDR /keybase &
KBFS=$!

wait "$SERVICE"
wait "$KBFS"
