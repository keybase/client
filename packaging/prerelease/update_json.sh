#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

cd /tmp

client_dir="$dir/../.."
zip_file=${ZIP_FILE:-}
bucket_name=${BUCKET_NAME:-}
app_version=${APP_VERSION}
platform=${PLATFORM:-"darwin"}
run_mode=${RUN_MODE:-"prod"}
sig_file="update-${app_version}.sig"
update_json_file="update-${platform}-${run_mode}-${app_version}.json"
s3host="https://s3.amazonaws.com/$bucket_name"

echo "Loading release tool"
"$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
release_bin="$GOPATH/bin/release"

rm -rf "$sig_file"
keybase sign -d -i "$zip_file" -o "$sig_file"

rm -rf "$update_json_file"
"$release_bin" update-json --version="$app_version" --src="$zip_file" \
  --uri="$s3host/$platform-updates" --signature="$sig_file" > "$update_json_file"
