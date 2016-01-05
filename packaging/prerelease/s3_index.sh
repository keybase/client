
#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

bucket_name=${BUCKET_NAME:-prerelease.keybase.io}
save_dir="/tmp/s3index"

echo "Loading release tool"
go get github.com/keybase/release
go install github.com/keybase/release
release_bin="$GOPATH/bin/release"

mkdir -p $save_dir
$release_bin index-html --bucket-name="$bucket_name" --prefixes="darwin/,linux/" --dest="$save_dir/index.html"
s3cmd sync --acl-public --disable-multipart $save_dir/* s3://$bucket_name/
