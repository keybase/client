#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

gopath=${GOPATH:-}

cd "$gopath/src/github.com/keybase/client/shared"

yarn run rn-start &
npm_cmd_pid=$!

while [[ -z "$(pgrep -P $npm_cmd_pid)" ]]
do
  echo "Waiting for packager to start"
  sleep 1
done

rn_packager_pid="$(pgrep -P $npm_cmd_pid)"

cleanup() {
  pkill -P "$rn_packager_pid"
}

trap 'cleanup' ERR

wait $npm_cmd_pid
cleanup
