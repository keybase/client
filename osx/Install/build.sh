#!/bin/sh
set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
DEST=$DIR

KB_GO_SRC=$GOPATH/src/github.com/keybase/client/go

#echo "Updating version"
#sh $KB_GO_SRC/version.sh

DAEMON_SRC=$KB_GO_SRC/daemon
echo "Using daemon source: $DAEMON_SRC"
cd $DAEMON_SRC

#echo "Updating sources (go get -u)..."
#go get -u

echo "Building (go build -a)..."
go build -a

#NOW=$(date +"%Y%m%d%H%M%S")

#TGZ=keybase-$VERSION.tar.gz
#DEST_TGZ=$DEST/tgz
#mkdir -p $DEST_TGZ

echo "Copying to $DEST"
cp $DAEMON_SRC/daemon $DEST/keybased

# echo "Packaging $TGZ"
# tar -zcvf $TGZ keybased

# echo "Cleaning up"
# rm $DEST_TGZ/keybased
