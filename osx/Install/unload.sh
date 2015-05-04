#!/bin/sh

set -e # Fail on error

cd ~/Library/LaunchAgents/

shopt -s nullglob
for f in keybase.Service*
do
  echo "Unloading and removing: $f"
  launchctl unload -w $f
  rm $f
done

