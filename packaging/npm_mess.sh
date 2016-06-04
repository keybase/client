#!/bin/bash

# Purposely not doing set -e, so we don't exit the script if npm failed

if [ ! -f "package.json" ]; then
  echo "Package.json not found, run this inside a dir with package.json"
  exit 1
fi

rm -r node_modules
for i in `seq 1 10`;
do
  echo "Trying to get deps, (try number: $i)"
  npm install
  npm_rc=$?
  if [[ $npm_rc -eq 0 ]]; then break; fi
  echo "Clearing old node_modules in react-native"
  rm -r $TMPDIR/npm*
  npm cache clean
done

if [[ $npm_rc -ne 0 ]]; then
  echo "Failed to setup node_modules"
  exit 1
fi

set -e -u -o pipefail # Fail on error

echo "Successfully setup node_modules! (after only $i tries)"
