#!/usr/bin/env bash
set -euo pipefail

version=${1:-}
if [ -z "$version" ]; then
  echo "Usage: ./release_windows_aws.sh 1.2.3.4-foo"
  exit 1
fi

aws s3 cp "s3://prerelease.keybase.io/windows/Keybase_${version}.amd64.msi" s3://prerelease.keybase.io/keybase_setup_amd64.msi

aws s3 cp "s3://prerelease.keybase.io/windows-support/update-windows-prod-${version}.json" s3://prerelease.keybase.io/update-windows-prod-v2.json

echo "Done."
