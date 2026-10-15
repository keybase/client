#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

client_dir="$dir/../.."
# shellcheck source=packaging/lib.sh
source "$dir/../lib.sh"
bucket_name=${BUCKET_NAME:-}

kb_release_bin
echo "$(go version)"

report=$("$KB_RELEASE_BIN" updates-report --bucket-name="$bucket_name")
"$client_dir/packaging/slack/send.sh" "\`\`\`$report\`\`\`"
echo "reporting complete"
