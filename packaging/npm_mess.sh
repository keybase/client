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
  if [[ $? -eq 0 ]]; then break; fi
  echo "Clearing old node_modules in react-native"
  rm -r $TMPDIR/npm*
  rm -r node_modules
  npm cache clean
done

set -e -u -o pipefail # Fail on error

if [ ! -d "node_modules" ]; then
  echo "Failed to setup node_modules"
  exit 1
fi

echo "Sucessfully setup node_modules! (after only $i tries)"
