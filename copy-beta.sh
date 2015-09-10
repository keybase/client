#!/bin/sh

set -e # Fail on error

# Change to dir where this script is located
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $DIR

# Read destination dir (repo)
DEST=$1
if [ "$DEST" = "" ]; then
  echo "No destination specified. Need /path/to/client-beta"
  exit
fi

# Archive the current client repo
rm -rf $DEST/client.tar
git archive --format tar HEAD > $DEST/client.tar

# Move to destination dir
cd $DEST

# These are the only dirs we want to extract
dirs=(go protocol)

for i in "${dirs[@]}"; do
  rm -rf $i
done

tar xpf client.tar ${dirs[@]}

rm client.tar
