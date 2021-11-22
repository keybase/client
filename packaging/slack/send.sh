#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

echo "$@"

# send to keybase chat if we have it in the environment
convid=${KEYBASE_CHAT_CONVID:-}
if [ -n "$convid" ]; then
  echo "Sending to Keybase convID: $convid"
  location=${KEYBASE_LOCATION:-"keybase"}
  home=${KEYBASE_HOME:-$HOME}
  msg=`echo -n "$@" | awk '{ printf "%s\\\n", $0 }'`
  $location --home $home chat api -m "{\"method\":\"send\", \"params\": {\"options\": { \"conversation_id\": \"$convid\" , \"message\": { \"body\": \"$msg\" }}}}"
fi
