#!env zsh
set -e

version=$1
if [ -z "$version" ]; then
  echo "Usage: ./aws-release.sh 1.2.3.4-foo"
  exit 1
fi

aws s3 cp s3://prerelease.keybase.io/windows/Keybase_${version}.386.exe s3://prerelease.keybase.io/keybase_setup_386.exe

aws s3 cp s3://prerelease.keybase.io/windows-support/update-windows-prod-${version}.json s3://prerelease.keybase.io/update-windows-prod-v2.json

echo "Done."
