#!/bin/sh

set -e # Fail on error

# Change to root repo dir
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

# Read destination dir (repo)
DEST=$1
if [ "$DEST" = "" ]; then
  echo "No destination specified. Need /path/to/client-beta"
  exit 1
fi

TAG=$2
if [ "$TAG" = "" ]; then
  echo "No tag specified"
  exit 1
fi

# Check dest exists
if [ ! -d "$DEST" ]; then
  echo "%DEST doesn't exist"
  exit 2
fi

# These are the only dirs we want to make available
dirs=(go protocol)

# Archive the current client repo
echo "Building git archive for $TAG"
cd $DIR/../..
git archive --format tar $TAG > $DIR/client.tar
cd $DIR
mkdir -p src/github.com/keybase/client
tar xpf client.tar -C src/github.com/keybase/client ${dirs[@]}

echo "Fetching dependencies"
GOPATH=$DIR go get github.com/keybase/client/go/keybase

# Tar and untar so we can exclude some files
tar cpf src.tar --exclude=.git README.md src
tar xpf src.tar -C $DEST

# Cleanup
rm -rf src pkg src.tar client.tar

echo "Now you should add, commit, tag and push the changes."
echo "

    cd $DEST
    git add .
    git commit -m \"Importing $TAG\"
    git tag -a $TAG -m $TAG

    git push
    git push --tags

"
