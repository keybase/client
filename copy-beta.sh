#!/bin/sh

set -e # Fail on error

# Change to dir where this script is located
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

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

# Archive the current client repo
rm -rf $DEST/client.tar
git archive --format tar $TAG > $DEST/client.tar

# Move to destination dir
cd $DEST

# These are the only dirs we want to extract
dirs=(go protocol)

for i in "${dirs[@]}"; do
  rm -rf $i
done

echo "Unpacking git archive"
tar xpf client.tar ${dirs[@]}
rm client.tar


echo "Now you should add, commit, tag and push the changes."
echo "

    cd $DEST
    git add .
    git commit -m \"Importing $TAG\"
    git tag -a $TAG -m $TAG

    git push
    git push --tags

"
