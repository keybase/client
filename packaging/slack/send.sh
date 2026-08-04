#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

echo "$@"

# send to keybase chat if we have it in the environment
convid=${KEYBASE_CHAT_CONVID:-}
if [ -n "$convid" ]; then
  echo "Sending to Keybase convID: $convid"
  location=${KEYBASE_LOCATION:-"keybase"}
  home=${KEYBASE_HOME:-$HOME}
  body="$*"
  payload=$(jq -cn --arg convID "$convid" --arg body "$body" \
    '{method:"send",params:{options:{conversation_id:$convID,message:{body:$body}}}}')
  "$location" --home "$home" chat api -m "$payload"
fi
