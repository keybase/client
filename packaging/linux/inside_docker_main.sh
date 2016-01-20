#! /bin/bash

# This script is the starting point for everything that happens inside our
# packaging docker. It expects to be invoked like this:
#
#     ./inside_docker_main.sh MODE TAG
#
# For example: ./inside_docker_main.sh staging v1.0.0-27
#
# Most of the packaging work is done by the rpm and deb layout scripts, which
# in turn call the respective packaging scripts in the client repo. This
# scripts job is to set up the build environment by creating a GOPATH and
# kicking off a gpg-agent.
#
# After running all of this, the server-ops repo will have the latest packages
# in origin/master. The final step of a release is then to ssh into
# dist.keybase.io and pull the server-ops repo there.

set -e -u -o pipefail

mode="$1"
tag="${2:-}"

if [ "$mode" = "production" ] && [ -z "$tag" ] ; then
  echo ERROR: in production mode, you must build from a git tag.
  exit 1
fi

# Import the code signing key, kick off the gpg agent, and sign an empty
# message with it. This makes the password prompt happen now, so that we don't
# interrupt the build later.
echo "Loading the Keybase code signing key in the container..."
code_signing_fingerprint="$(cat /CLIENT/packaging/linux/code_signing_fingerprint)"
gpg --import --quiet < /GPG/code_signing_key
true > /GPG/code_signing_key  # truncate it, just in case
eval $(gpg-agent --daemon)
gpg --sign --use-agent --default-key "$code_signing_fingerprint" \
  --output /dev/null /dev/null

# Copy the repos we'll be using to build.
echo "Copying the client repo..."
client_clone="/root/client"
cp -r /CLIENT "$client_clone"
echo "Copying the kbfs repo..."
kbfs_clone="/root/kbfs"
cp -r /KBFS "$kbfs_clone"

# Optionally check out the tag we're building.
if [ -n "$tag" ] ; then
  echo "Checkout out tag '$tag'..."
  git -C "$client_clone" checkout "$tag"
fi

# Build all the packages!
build_dir="/root/keybase_build"
"$client_clone/packaging/linux/build_binaries.sh" "$mode" "$build_dir"
"$client_clone/packaging/linux/deb/layout_repo.sh" "$build_dir"
"$client_clone/packaging/linux/rpm/layout_repo.sh" "$build_dir"
