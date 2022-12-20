#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

client_dir="$dir/../.."
bucket_name=${BUCKET_NAME:-}

echo "Loading release tool"
(cd "$client_dir/go" && go install "github.com/keybase/release")
release_bin="$GOPATH/bin/release"
echo "$(go version)"

report=$("$release_bin" updates-report --bucket-name="$bucket_name")
"$client_dir/packaging/slack/send.sh" "\`\`\`$report\`\`\`"
echo "reporting complete"
