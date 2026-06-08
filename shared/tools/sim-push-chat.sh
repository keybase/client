#!/bin/bash
# Send a chat.newmessage push notification to the booted iOS simulator.
# Usage: sim-push-chat.sh [conversationIDKey]
CONV_ID="${1:-0000b386ba31eebeea5d8ba781aa8ccb4e0c31b6d9a210e74964b42d2d5726c1}"
PAYLOAD=$(cat <<EOF
{
  "aps": {
    "alert": "New chat message",
    "sound": "default",
    "badge": 1
  },
  "type": "chat.newmessage",
  "convID": "$CONV_ID",
  "t": "3",
  "m": "",
  "userInteraction": true
}
EOF
)
echo "$PAYLOAD" | xcrun simctl push booted keybase.ios -
