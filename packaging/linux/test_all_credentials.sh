#! /usr/bin/env bash

# Our build relies on a bunch of different credentials (GPG key, SSH key, etc).
# This script helps us make sure a build machine has all the credentials it
# needs.

set -e -u -o pipefail

here="$(dirname "${BASH_SOURCE[0]}")"

# This avoids getting yes/no dialogs if a git repo isn't in your
# ~/.ssh/known_hosts file.
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no"

bucket="${BUCKET_NAME:-prerelease.keybase.io}"
echo "Checking credentials for s3://$bucket..."
"$here/s3cmdwr" ls "s3://$bucket" > /dev/null

echo 'Checking Arch AUR credentials...'
git ls-remote aur:keybase-git > /dev/null
git ls-remote aur:keybase-bin > /dev/null

echo 'Checking the GPG code signing key...'
fingerprint="$(cat "$here/code_signing_fingerprint")"
gpg --sign --use-agent --local-user="$fingerprint" <<< "junk" > /dev/null

echo "SUCCESS!"
