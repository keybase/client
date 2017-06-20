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
if [ -z "$KBFS_METADATA_VERSION" ]; then
    export KBFS_METADATA_VERSION=3
fi
echo "Using KBFS metadata version $KBFS_METADATA_VERSION"

if [ -f kbfs_revision ]; then
    echo "Running KBFS Docker with KBFS revision $(cat kbfs_revision)"
fi
if [ -f client_revision ]; then
    echo "Client revision $(cat client_revision)"
fi

keybase -debug service &
SERVICE=$!
# Journaling is turned off for all tests until we change the tests to
# turn it on/off when needed, since some tests depend on sync
# semantics.
KEYBASE_DEBUG=1 kbfsfuse -debug -enable-disk-cache -enable-journal=false -mdserver $MDSERVER_ADDR -bserver $BSERVER_ADDR -localuser= -md-version $KBFS_METADATA_VERSION -log-to-file /keybase &
KBFS=$!

wait "$SERVICE"
wait "$KBFS"
