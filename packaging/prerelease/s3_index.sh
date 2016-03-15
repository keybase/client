#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

client_dir="$dir/../.."
bucket_name=${BUCKET_NAME:-}
save_dir="/tmp/s3index"

if [ "$bucket_name" = "" ]; then
  echo "No BUCKET_NAME"
  exit 1
fi

echo "Loading release tool"
"$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
release_bin="$GOPATH/bin/release"

# Clear files
rm -rf "$save_dir"
mkdir -p "$save_dir"

echo "Creating index files"
"$release_bin" index-html --bucket-name="$bucket_name" --prefixes="darwin/,linux_binaries/deb/,linux_binaries/rpm/,windows/" --dest="$save_dir/index.html"
"$release_bin" index-html --bucket-name="$bucket_name" --prefixes="electron-sourcemaps/" --dest="$save_dir/electron-sourcemaps/index.html"

echo "Syncing index files"
s3cmd sync --acl-public --disable-multipart $save_dir/* s3://$bucket_name/

echo "Linking latest"
"$release_bin" latest --bucket-name="$bucket_name"

echo "Checking test releases"
"$release_bin" promote-test-releases --bucket-name="$bucket_name"

echo "Checking releases"
"$release_bin" promote-releases --bucket-name="$bucket_name"
