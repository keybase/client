#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

# Outputs to slack if you have slackbot installed and SLACK_TOKEN and
# SLACK_CHANNEL set. This is primarily for build boxes.

sender="$GOPATH/src/github.com/keybase/slackbot/send/main.go"

echo "$@"
if [ -f $sender ]; then
  go run $sender -i=1 "$@"
fi
