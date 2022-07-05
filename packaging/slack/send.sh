#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

# Outputs to slack if you have slackbot installed and SLACK_TOKEN and
# SLACK_CHANNEL set. This is primarily for build boxes.

sender="$GOPATH/src/github.com/keybase/slackbot/send/main.go"

echo "$@"
if [ -f $sender ]; then
  go run $sender -i=1 "$@"
fi

# send to keybase chat if we have it in the environment
convid=${KEYBASE_CHAT_CONVID:-}
if [ -n "$convid" ]; then
  echo "Sending to Keybase convID: $convid"
  location=${KEYBASE_LOCATION:-"keybase"}
  home=${KEYBASE_HOME:-$HOME}
  msg=`echo -n "$@" | awk '{ printf "%s\\\n", $0 }'`
  $location --home $home chat api -m "{\"method\":\"send\", \"params\": {\"options\": { \"conversation_id\": \"$convid\" , \"message\": { \"body\": \"$msg\" }}}}"
fi