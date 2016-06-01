#!/bin/bash

_term() {
    echo "Caught TERM signal"
    kill -TERM "$SERVICE"
    kill -TERM "$KBFS"
    exit 0
}
trap _term SIGTERM

keybase service &
SERVICE=$!
kbfsfuse -debug -mdserver $MDSERVER_ADDR -bserver $BSERVER_ADDR -enable-sharing-before-signup /keybase &
KBFS=$!

wait "$SERVICE"
wait "$KBFS"
