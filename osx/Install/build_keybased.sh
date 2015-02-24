set -e # Fail on error

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
DEST=$DIR

DAEMON_SRC=~/Projects/go/src/github.com/keybase/go/daemon
echo "Using source: $DAEMON_SRC"

cd $DAEMON_SRC
#echo "Updating sources (go get -u)..."
#go get -u
echo "Building (go build -a)..."
go build -a

#NOW=$(date +"%Y%m%d%H%M%S")

VERSION=`git describe master`
echo "Version: $VERSION"

#TGZ=keybase-$VERSION.tar.gz
#DEST_TGZ=$DEST/tgz
#mkdir -p $DEST_TGZ

echo "Copying to $DEST"
cp $DAEMON_SRC/daemon $DEST/keybased

# echo "Packaging $TGZ"
# tar -zcvf $TGZ keybased

# echo "Cleaning up"
# rm $DEST_TGZ/keybased
