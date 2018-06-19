#! /usr/bin/env bash

# This script is the starting point for everything that happens inside our
# packaging docker. It expects to be invoked like this:
#
#     ./inside_docker_main.sh MODE COMMIT
#
# For example: ./inside_docker_main.sh staging v1.0.0-27

set -e -u -o pipefail

mode="$1"
commit="$2"

client_clone="/root/client"
kbfs_clone="/root/kbfs"
build_dir="/root/build"

# Copy the s3cmd config to root's home dir.
cp /S3CMD/.s3cfg ~

# Same with the GitHub token.
cp /GITHUB_TOKEN/.github_token ~

# Copy the SSH configs to the home dir. We copy instead of sharing directly
# from the host, because SSH complains if ~/.ssh/config is owned by anyone
# other than the current user. Cloning repos below will test these credentials.
cp -r /SSH ~/.ssh

# Import the code signing key, kick off the gpg agent, and sign an empty
# message with it. This makes the password prompt happen now, so that we don't
# interrupt the build later.
echo "Loading the Keybase code signing key in the container..."
code_signing_fingerprint="$(cat /CLIENT/packaging/linux/code_signing_fingerprint)"
# Specifically use GnuPG v1 for the import, because modern versions need the
# decryption password here, for some stupid reason, totally duplicative of the
# password they'll need again below when we load the key into the agent.
gpg1 --import < /GPG/code_signing_key
true > /GPG/code_signing_key  # truncate it, just in case
# Use very long lifetimes for the key in memory, so that we don't forget it in
# the middle of a nightly loop.
eval "$(gpg-agent --daemon --max-cache-ttl 315360000 --default-cache-ttl 315360000)"
gpg --sign --use-agent --local-user "$code_signing_fingerprint" \
  --output /dev/null /dev/null

# Clone all the repos we'll use in the build. The --reference flag makes this
# pretty cheap. (The shared repos we're referencing were just updated by
# docker_build.sh, so we shouldn't need any new objects.) Configure the
# user.name and user.email so that we can make commits in the AUR package repo.
git config --global user.name "Keybase Linux Build"
git config --global user.email "example@example.com"
echo "Cloning the client repo..."
git clone git@github.com:keybase/client "$client_clone" --reference /CLIENT
echo "Cloning the kbfs repo..."
git clone git@github.com:keybase/kbfs "$kbfs_clone" --reference /KBFS

# Check out the given client commit.
git -C "$client_clone" checkout -f "$commit"

# Do the build!
"$client_clone/packaging/linux/build_and_push_packages.sh" "$mode" "$build_dir"
