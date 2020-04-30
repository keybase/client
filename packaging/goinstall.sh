#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

package="$1"
nopull=${NOPULL:-}
src_dir="$GOPATH/src/$package"

if [ ! -d "$GOPATH/src/$package" ]; then
  git clone "https://$package" "$src_dir"
elif [ -z "$nopull" ]; then
  "$dir/check_status_and_pull.sh" "$src_dir"
fi

# We don't go get -u for dependencies since we assume this is used on vendored
# packages, packages using gomodules, or dependencies are updated manually.

go install "$package"
