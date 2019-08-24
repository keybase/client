#! /usr/bin/env bash

# Our build relies on a bunch of different credentials (GPG key, SSH key, etc).
# This script helps us make sure a build machine has all the credentials it
# needs.

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

# This avoids getting yes/no dialogs if a git repo isn't in your
# ~/.ssh/known_hosts file.
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=no"

bucket="${BUCKET_NAME:-prerelease.keybase.io}"
echo "Checking credentials for s3://$bucket (~/.s3cfg)..."
s3cmd ls "s3://$bucket" > /dev/null

echo 'Checking Arch AUR credentials (~/.ssh)...'
git ls-remote aur@aur.archlinux.org:keybase-git > /dev/null
git ls-remote aur@aur.archlinux.org:keybase-bin > /dev/null

# The release tool needs a GitHub API token to check test status. This is
# independent of the SSH keys we checked above.
echo 'Checking GitHub API credentials (~/.github_token)...'
github_token="$(cat ~/.github_token)"
github_url="https://api.github.com/?access_token=$github_token"
curl --fail --silent --show-error "$github_url" > /dev/null

echo 'Checking the GPG code signing key...'
fingerprint="$(cat "$here/code_signing_fingerprint")"
gpg --sign --use-agent --local-user="$fingerprint" <<< "junk" > /dev/null

echo "SUCCESS!"
