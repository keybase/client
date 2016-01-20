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
version="$(cat "$build_dir/VERSION")"

if [ "$mode" = "devel" ] ; then
  echo "Devel mode does not push. Quitting."
  exit
fi

release_prerelease() {
  echo Doing a prerelease push to S3...
}

release_serverops() {
  serverops_clone="/root/server-ops"
  if [ "$mode" = staging ] ; then
    deb_repo="$serverops_clone/prod/linux/deb_staging"
    rpm_repo="$serverops_clone/prod/linux/rpm_staging"
  elif [ "$mode" = production ] ; then
    deb_repo="$serverops_clone/prod/linux/deb"
    rpm_repo="$serverops_clone/prod/linux/rpm"
  else
    echo "WHAT IS '$mode' MODE? (╯°□°）╯︵ ┻━┻)"
    exit 1
  fi

  echo Copying the server-ops repo...
  cp -r /SERVEROPS "$serverops_clone"
  echo Pushing to server-ops...
  mkdir -p "$serverops_clone/prod/linux"
  rm -rf "$deb_repo"
  cp -r "$build_dir/deb_repo" "$deb_repo"
  rm -rf "$rpm_repo"
  cp -r "$build_dir/rpm_repo" "$rpm_repo"
  git -C "$serverops_clone" add -A
  git -C "$serverops_clone" commit -m "new Linux $mode packages, version $version"
  git -C "$serverops_clone" push
}

# RELEASE THE PACKAGES! In prerelease mode, this involves a push to S3. In
# other modes, we check in package files to the server-ops repo.
if [ "$mode" = prerelease ] ; then
  release_prerelease
else
  release_serverops
fi
