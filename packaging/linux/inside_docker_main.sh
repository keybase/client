#! /usr/bin/env bash

# This script is the starting point for everything that happens inside our
# packaging docker. It expects to be invoked like this:
#
#     ./inside_docker_main.sh MODE TAG
#
# For example: ./inside_docker_main.sh staging v1.0.0-27
#
# TAG is optional for modes other than production. MODE can be "nightly", which
# puts this script into a loop.

set -e -u -o pipefail

mode="$1"
tag="${2:-}"

client_copy="/root/client"
kbfs_copy="/root/kbfs"
serverops_copy="/root/server-ops"
build_dir="/root/build"

# Copy the s3cmd config to root's home dir, if it exists.
if [ -e /S3CMD/.s3cfg ] ; then
  cp /S3CMD/.s3cfg ~
fi

# Import the code signing key, kick off the gpg agent, and sign an empty
# message with it. This makes the password prompt happen now, so that we don't
# interrupt the build later.
echo "Loading the Keybase code signing key in the container..."
code_signing_fingerprint="$(cat /CLIENT/packaging/linux/code_signing_fingerprint)"
gpg --import --quiet < /GPG/code_signing_key
true > /GPG/code_signing_key  # truncate it, just in case
# Use very long lifetimes for the key in memory, so that we don't forget it in
# the middle of a nightly loop.
eval "$(gpg-agent --daemon --max-cache-ttl 315360000 --default-cache-ttl 315360000)"
gpg --sign --use-agent --default-key "$code_signing_fingerprint" \
  --output /dev/null /dev/null

# Make fresh clones of the repos we want to build, so that we don't get
# confused by any state in the host's working copy. Using the --reference flag
# means that these clones can still use the git objects that the host already
# has.
echo "Cloning the client repo..."
git clone git@github.com:keybase/client "$client_copy" --reference /CLIENT
echo "Copying the kbfs repo..."
git clone git@github.com:keybase/kbfs "$kbfs_copy" --reference /KBFS
if [ "$mode" != prerelease ] && [ "$mode" != nightly ] ; then
  echo "Copying the server-ops repo..."
  git clone git@github.com:keybase/server-ops "$serverops_copy" --reference /SERVEROPS
  git -C "$serverops_copy" config user.name "Keybase Linux Build"
  git -C "$serverops_copy" config user.email "example@example.com"
fi

# If we're not entering a nightly build loop (where everything by definition
# happens from master) then we'll build whatever working copy these repos have
# checked out. However, if a tag was provided, switch to that.
if [ -n "$tag" ] ; then
  git -C "$client_copy" checkout -f "$tag"
fi

# In a non-nightly build mode, do the build once and then short-circuit.
if [ "$mode" != nightly ] ; then
  "$client_copy/packaging/linux/build_and_push_packages.sh" "$mode" "$build_dir"
  exit "$?"
fi

# NIGHTLY MODE

ny_date() {
  TZ=America/New_York date "$@"
}

refresh_one_repo() {
  git -C "$1" fetch
  # Calls to check_status_and_pull.sh break if we're not on master.
  git -C "$1" checkout -f master
  git -C "$1" reset --hard origin/master
  # `npm install` is unreliable if the repo isn't clean.
  git -C "$1" clean -dffx
}

refresh_repos() {
  refresh_one_repo "$client_copy"
  refresh_one_repo "$kbfs_copy"
}

push_kbfs_beta() {
  kbfs_beta_copy="/root/kbfs-beta"
  kbfs_beta_gopath="/root/kbfs-beta-gopath"
  if ! [ -e "$kbfs_beta_copy" ] ; then
    git clone git@github.com:keybase/kbfs-beta "$kbfs_beta_copy"
    git -C "$kbfs_beta_copy" config user.name "nightly build"
    git -C "$kbfs_beta_copy" config user.email "nightly build"
    # Make the fake GOPATH, because export_kbfs.sh wants it.
    mkdir -p "$kbfs_beta_gopath/src/github.com/keybase/"
    ln -snf "$client_copy" "$kbfs_beta_gopath/src/github.com/keybase/client"
    ln -snf "$kbfs_copy" "$kbfs_beta_gopath/src/github.com/keybase/kbfs"
    ln -snf "$kbfs_beta_copy" "$kbfs_beta_gopath/src/github.com/keybase/kbfs-beta"
  fi
  git -C "$kbfs_beta_copy" pull --ff-only
  GOPATH="$kbfs_beta_gopath" "$client_copy/packaging/export/export_kbfs.sh"
}

# I don't want to have to think about what happens to sleep when a machine
# suspends for a long time and wakes up. So instead of a big sleep, we do
# little one minute sleeps, and do a build whenever we happen to wake up at
# noon.

# Do an early refresh, to catch errors.
refresh_repos

echo Entering nightly loop...
last_build_day=""
while true ; do
  current_day="$(ny_date +%d)"
  current_hour="$(ny_date +%H)"
  # Build if it's noon and we haven't already built today.
  if [ "$current_day" != "$last_build_day" ] && [ "$current_hour" = 12 ] ; then
    last_build_day="$current_day"
    echo -e "\n\n\n=================== STARTING A BUILD ===================="
    ny_date
    refresh_repos
    push_kbfs_beta
    # Each nightly build happens in prerelease mode. Suppress errors in the
    # build script with `|| true`, so that the nightly loop continues.
    "$client_copy/packaging/linux/build_and_push_packages.sh" prerelease "$build_dir" || true
    echo "=================== BUILD FINISHED ===================="
  fi
  sleep 60
done
