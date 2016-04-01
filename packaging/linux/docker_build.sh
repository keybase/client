#! /usr/bin/env bash

# This script is the starting point for linux packaging builds. Here's what the
# build does:
#   1) create the "keybase_packaging_v*" docker image, if it doesn't exist
#   2) run the "inside_docker_main.sh" script in that image, sharing several
#      directories from your host, which does all the following...
#   3) build .deb and .rpm packages and lay them out along with the new repo
#      metadata and signatures in your server-ops repo (which is shared
#      read-write with the container)
#   4) commit and push the server-ops repo, or for prerelease builds, push to
#      our S3 bucket
#
# This script mostly concerns itself with updating git repos and organizing
# GPG/SSH/S3 keys for the docker container.

set -e -u -o pipefail

if [ "$#" != 2 ] ; then
  echo Usage: docker_build.sh MODE COMMIT
  exit 1
fi

mode="$1"

here="$(dirname "$BASH_SOURCE")"

clientdir="$(git -C "$here" rev-parse --show-toplevel)"
kbfsdir="$clientdir/../kbfs"
serveropsdir="$clientdir/../server-ops"

# Run `git fetch` in all the repos we'll share with the container. This
# prevents an unattended build machine from falling behind over time.
for repo in "$clientdir" "$kbfsdir" "$serveropsdir" ; do
  echo "Fetching $repo"
  git -C "$repo" fetch
done

# Arrange to share the S3 credentials. We have to do this with a directory
# instead of sharing the file directly, because the latter only works on Linux.
s3cmd_temp="$(mktemp -d)"
cp ~/.s3cfg "$s3cmd_temp"

# Make sure the image is ready.
image=keybase_packaging_v5
if [ -z "$(docker images -q "$image")" ] ; then
  echo "Docker image '$image' not yet built. Building..."
  docker build -t "$image" "$clientdir/packaging/linux"
fi

# Prepare a folder that we'll share with the container, as the container's
# /root directory, where all the build work gets done. Docker recommends that
# write-heavy work happen in shared folders, for better performance.
# (https://docs.docker.com/engine/userguide/storagedriver/device-mapper-driver:
# "data volumes provide the best and most predictable performance. This is
# because they bypass the storage driver and do not incur any of the potential
# overheads introduced by thin provisioning and copy-on-write. For this reason,
# you should to place heavy write workloads on data volumes.")
#
# Other reasons for preferring a shared folder:
# 1) It avoids hiding a ton of disk usage in btrfs subvolumes that you won't
# remember to clean up.
# 2) It's a requirement os OSX (and probably Windows), where docker containers
# run inside a hidden VirtualBox VM. That VM has very little disk space, and we
# have to use shared folders to take advantage of the host's storage.
#
# Note that even though we're creating this folder in the current user's home
# directory, it's going to end up full of files owned by root. Such is Docker.
mkdir -p "$HOME/keybase_builds"
shared_dir="$HOME/keybase_builds/$(date +%Y_%m_%d_%H%M%S)_$mode"
# No -p here. It's an error if this directory already exists.
mkdir "$shared_dir"

# Export the GPG code signing key. Share a directory instead of a file, because
# Docker on OSX doesn't support sharing individual files.
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
# GPG code signing key. For the crazy array notation we're using with
# serverops_args and osx_args, see http://stackoverflow.com/a/7577209/823869.
docker run -ti \
  -v "$shared_dir:/root" \
  -v "$clientdir:/CLIENT:ro" \
  -v "$kbfsdir:/KBFS:ro" \
  -v "$serveropsdir:/SERVEROPS:ro" \
  -v "$gpg_tempdir:/GPG" \
  -v "$HOME/.ssh:/SSH:ro" \
  -v "$s3cmd_temp:/S3CMD:ro" \
  -e BUCKET_NAME \
  "$image" \
  bash /CLIENT/packaging/linux/inside_docker_main.sh "$@"
