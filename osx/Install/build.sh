#!/bin/sh
set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
DEST=$DIR

KB_GO_SRC=$GOPATH/src/github.com/keybase/client/go

#echo "Updating version"
#sh $KB_GO_SRC/version.sh

#
# Daemon
#

DAEMON_SRC=$KB_GO_SRC/daemon
echo "Using keybased source: $DAEMON_SRC"
cd $DAEMON_SRC

echo "Building keybased (go build -a)..."
go build -a

echo "Copying keybased to $DEST"
cp $DAEMON_SRC/daemon $DEST/keybased

#
# CLI
#

CLI_SRC=$KB_GO_SRC/client
echo "Using keybase source: $CLI_SRC"
cd $CLI_SRC

echo "Building keybase (go build -a)..."
go build -a

echo "Copying keybase to $DEST"
cp $CLI_SRC/client $DEST/keybase
