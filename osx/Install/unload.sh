#!/bin/sh

set -e # Fail on error

cd ~/Library/LaunchAgents/

shopt -s nullglob
for f in keybase.*
do
  echo "Unloading and removing: $f"
  launchctl unload $f
  rm $f
done

