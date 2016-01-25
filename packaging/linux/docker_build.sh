#! /bin/bash

# This script is the starting point for linux packaging builds. Here's what it
# does:
#   1) create the "keybase_packaging_v*" docker image, if it doesn't exist
#   2) run the "inside_docker_main.sh" script in that image, sharing several
#      directories from your host, which does all the following...
#   3) build .deb and .rpm packages and lay them out along with the new repo
#      metadata and signatures in your server-ops repo (which is shared
#      read-write with the container)
#   4) commit and push the server-ops repo, or for prerelease builds, push to
#      our S3 bucket
#
# You need to have docker installed, and all the directories shared with -v
# below need to contain code or keys.

set -e -u -o pipefail

if [ "$#" -lt 1 ] ; then
  echo Usage: docker_build.sh MODE TAG
  exit 1
fi

here="$(dirname "$BASH_SOURCE")"

clientdir="$(git -C "$here" rev-parse --show-toplevel)"

# Make sure the SERVEROPSDIR is there and up to date.
if [ -z "${SERVEROPSDIR:-}" ] ; then
  echo You must define SERVEROPSDIR to point to your clone of keybase/server-ops.
  exit 1
fi
"$here/../check_status_and_pull.sh" "$SERVEROPSDIR"

# Make sure KBFS is there and up to date.
kbfsdir="$clientdir/../kbfs"
"$here/../check_status_and_pull.sh" "$kbfsdir"

# TODO: Make sure Amazon S3 credentials are working.

# Get the current git configs for making commits.
git_name="$(git -C "$SERVEROPSDIR" config user.name || true)"
git_email="$(git -C "$SERVEROPSDIR" config user.email || true)"
if [ -z "$git_name" ] || [ -z "$git_email" ] ; then
  echo "The server-ops repo doesn't have user.name and user.email configured."
  exit 1
fi

# Make sure the image is ready.
image=keybase_packaging_v3
if [ -z "$(docker images -q "$image")" ] ; then
  echo "Docker image '$image' not yet built. Building..."
  docker build -t "$image" "$clientdir/packaging/linux"
fi

# XXX: Avoid running out of disks space on OSX. OSX is a special snowflake.
# Containers run inside a VirtualBox Linux VM, and disk writes wind up in a
# tmpfs in that VM's very limited memory (instead of a btrfs subvolume on the
# host's disk, as with a regular Linux host). That's no good for our builds,
# which consume ~2GB of space. Docker has special support for sharing folders
# from /Users, so we create such a folder and mount it as /root in the
# container. (See https://docs.docker.com/userguide/dockervolumes, the notes
# about Mac/Windows.) We have to be sure that all our copies and builds happen
# in this folder.
osx_args=()
if [ "$(uname)" = Darwin ] ; then
  host_root_temp="$(mktemp -d "$HOME/docker_temp_XXXX")"
  echo "Created temp folder '$host_root_temp'."
  osx_args=(-v "$host_root_temp:/root")
  # Make sure we delete all this crap when we exit.
  cleanup() {
    echo "Cleaning up '$host_root_temp'..."
    rm -rf "$host_root_temp"
  }
  trap cleanup EXIT
fi

# Export the GPG code signing key. Share a directory instead of a file, because
# Docker on OSX doesn't support sharing files.
code_signing_fingerprint="$(cat "$here/code_signing_fingerprint")"
echo "Exporting the Keybase code signing key ($code_signing_fingerprint)..."
gpg_tempdir="$(mktemp -d)"
gpg_tempfile="$gpg_tempdir/code_signing_key"
echo gpg_tempfile $gpg_tempfile
gpg --export-secret-key --armor "$code_signing_fingerprint" > "$gpg_tempfile"

# Run the docker with several directories shared read-only from the host:
#   - the server-ops repo
#   - the client repo
#   - ~/.ssh
# Also export several env vars for git configuration and to pass through the
# GPG code signing key. For the crazy array notation we're using with osx_args,
# see http://stackoverflow.com/a/7577209/823869.
docker run -ti \
  -v "$SERVEROPSDIR:/SERVEROPS:ro" \
  -v "$clientdir:/CLIENT:ro" \
  -v "$kbfsdir:/KBFS:ro" \
  -v "$HOME/.aws:/root/.aws:ro" \
  -v "$HOME/.ssh:/root/.ssh:ro" \
  -v "$gpg_tempdir:/GPG" \
  "${osx_args[@]:+${osx_args[@]}}" \
  -e GIT_AUTHOR_NAME="$git_name" \
  -e GIT_COMMITTER_NAME="$git_name" \
  -e EMAIL="$git_email" \
  "$image" \
  bash /CLIENT/packaging/linux/inside_docker_main.sh "$@"
