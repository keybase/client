#!/bin/sh
set -e # Fail on error

if [ "$GOPATH" = "" ]; then
  "No GOPATH"
  exit 1
fi

KB_GO_SRC="$GOPATH/src/github.com/keybase/client/go"
KBFS_GO_SRC="$GOPATH/src/github.com/keybase/kbfs"

DEST="/Applications/Keybase.app/Contents/SharedSupport/bin/"

ditto $KB_GO_SRC/keybase/keybase $DEST/keybase
ditto $KBFS_GO_SRC/kbfsfuse/kbfsfuse $DEST/kbfsfuse
