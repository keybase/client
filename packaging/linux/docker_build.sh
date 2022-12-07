#! /usr/bin/env bash

# This script is the starting point for Linux packaging builds. Here's what the
# build does:
#   1) create the "keybase_packaging_v*" docker image, if it doesn't exist
#   2) run the "inside_docker_main.sh" script in that image, sharing several
#      directories from your host, which does all the following...
#   3) build .deb and .rpm packages and lay them out along with the new repo
#      metadata and signatures
#   4) push the packages and repo metadata to our prerelease.keybase.io S3 bucket
#
# This script mostly concerns itself with updating git repos and organizing
# GPG/SSH/S3 keys for the docker container.

set -euox pipefail

if [ "$#" != 2 ] ; then
  echo Usage: docker_build.sh MODE COMMIT
  exit 1
fi

mode="$1"

here="$(dirname "${BASH_SOURCE[0]}")"

clientdir="$(git -C "$here" rev-parse --show-toplevel)"

# Run `git fetch` in all the repos we'll share with the container. This
# prevents an unattended build machine from falling behind over time.
echo "Fetching $clientdir"
git -C "$clientdir" fetch

# Arrange to share the S3 credentials. We have to do this with a directory
# instead of sharing the file directly, because the latter only works on Linux.
s3cmd_temp="$(mktemp -d)"
cp "/keybase/team/$SECRETS_TEAM/.kbfs_autogit/$SECRETS_REPO/dot_s3cfg" "$s3cmd_temp/.s3cfg"

# Copy necessary SSH keys out of KBFS
ssh_temp="$(mktemp -d)"
cp "/keybase/team/$SECRETS_TEAM/.kbfs_autogit/$SECRETS_REPO/aur_id_ed25519" "$ssh_temp"
cp "$HOME/.ssh/config" "$ssh_temp"
cp "$HOME/.ssh/known_hosts" "$ssh_temp"

# Prepare a folder that we'll share with the container, as the container's
# /root directory, where all the build work gets done. Docker recommends that
# write-heavy work happen in shared folders, for better performance.
work_dir="/var/tmp/keybase_build_$(date +%Y_%m_%d_%H%M%S)_$mode"
mkdir "$work_dir"  # no -p, it's intentionally an error if this exists

# Export the GPG code signing key. We can't just share the ~/.gnupg directory,
# because the host might have a different GnuPG version than the container, and
# GnuPG 2.1 broke back-compat. Sigh. As with S3 above, we need to share the key
# in a directory rather than just a file, for non-Linux support.
code_signing_fingerprint="$("$here/fingerprint.sh")"
echo "Exporting the Keybase code signing key ($code_signing_fingerprint)..."
gpg_tempdir="$(mktemp -d)"
gpg_tempfile="$gpg_tempdir/code_signing_key"
gpg --export-secret-key --armor "$code_signing_fingerprint" > "$gpg_tempfile"

# Make sure the Docker image is built.
image=keybase_packaging_v38
if [ -z "$(sudo docker images -q "$image")" ] ; then
  echo "Docker image '$image' not yet built. Building..."
  sudo docker build -t "$image" "$clientdir/packaging/linux"
fi

# Run the docker job in interactive mode if we're actually talking to a
# terminal. Interactive mode is required when the code signing key is password
# protected, because gpg has to prompt you for the password. But docker will
# refuse to start in interactive mode if it doesn't actually have a terminal to
# talk to, like in a buildbot job. This check lets us have our stdin cake and
# eat it too.
if [ -t 0 ] ; then
  # Stdin is a terminal.
  interactive_args=("--tty" "--interactive")
else
  interactive_args=()
fi

if [ -n "${KEYBASE_RELEASE:-}" ]; then
    if [ "${KEYBASE_TEST_CODE_SIGNING_KEY:-}" = "1" ]; then
        echo "cannot use test code signing key for a release"
        exit 1
    fi
fi

echo '=== docker ==='
sudo docker run "${interactive_args[@]:+${interactive_args[@]}}" \
  -v "$work_dir:/root" \
  -v "$clientdir:/CLIENT:ro" \
  -v "$gpg_tempdir:/GPG" \
  -v "$ssh_temp:/SSH:ro" \
  -v "$s3cmd_temp:/S3CMD:ro" \
  -e "BUCKET_NAME=${BUCKET_NAME:-}" \
  -e "KEYBASE_RELEASE=${KEYBASE_RELEASE:-}" \
  -e "KEYBASE_NIGHTLY=${KEYBASE_NIGHTLY:-}" \
  -e "KEYBASE_TEST=${KEYBASE_TEST:-}" \
  -e "KEYBASE_TEST_CODE_SIGNING_KEY=${KEYBASE_TEST_CODE_SIGNING_KEY:-}" \
  --rm \
  "$image" \
  bash /CLIENT/packaging/linux/inside_docker_main.sh "$@"

echo "Deleting old build files"
sudo find "$(dirname "$work_dir")" -maxdepth 1 -mindepth 1 ! -wholename "$work_dir" -type d -exec rm -rf {} +
