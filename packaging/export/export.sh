#!/bin/sh

set -e # Fail on error

# What to export
EXPORT=$1
if [ "$EXPORT" = "" ]; then
  echo "No dirs specified"
  exit 1
elif [ "$EXPORT" = "client" ]; then
  DIRS=(go protocol)
elif [ "$EXPORT" = "kbfs" ]; then
  DIRS=(kbfs kbfsfuse libfuse libkbfs)
fi

# Source dir (private repo)
SRC="$GOPATH/src/github.com/keybase/$EXPORT"

# Destination dir (beta repo)
DEST=$2
if [ "$DEST" = "" ]; then
  echo "No destination dir specified. Need /path/to/beta/repo"
  exit 1
fi

if [ ! -d "$DEST" ]; then
  echo "$DEST doesn't exist"
  exit 2
fi

TAG=$3
if [ "$TAG" = "" ]; then
  echo "No tag specified"
  exit 1
fi

echo "Source: $SRC"
echo "Dirs to export: $DIRS"
echo "Destination: $DEST"
echo "Tag: $TAG"
echo " "

# Archive the repo
cd $SRC
echo "Building git archive for $TAG ($SRC)"
git archive --format tar $TAG > $SRC/$EXPORT.tar

# Copy archive to dest and unpack
echo "Unpacking archive in $DEST"
cd $DEST
rm -rf $EXPORT
mkdir -p $EXPORT
tar xpf $SRC/$EXPORT.tar -C $EXPORT ${DIRS[@]}

rm $SRC/$EXPORT.tar

echo "
Now you should add, commit, tag and push the changes in the $EXPORT-beta repository.

    cd $DEST
    git add .
    git commit -m \"Importing from $TAG\"
    git push

If you tagged:

    git tag -a $TAG -m $TAG
    git push --tags

"
