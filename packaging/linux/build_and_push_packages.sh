#! /usr/bin/env bash

# This script does a complete Linux build and publishes the results:
#   1) Build Linux binaries with Go and Electron
#   2) Make .deb packages, and lay them out in a signed repo.
#   3) Make .rpm packages, sign them, and lay them out in a repo.
#   4) Push all of this to server-ops or S3.

set -e -u -o pipefail

mode="$1"
build_dir="$2"

here="$(dirname "$BASH_SOURCE")"
client_dir="$(git -C "$here" rev-parse --show-toplevel)"
serverops_dir="$client_dir/../server-ops"
kbfs_dir="$client_dir/../kbfs"

# Test all the different credentials that need to be configured.
"$here/test_all_credentials.sh"

export BUCKET_NAME="${BUCKET_NAME:-prerelease.keybase.io}"
echo "Using BUCKET_NAME $BUCKET_NAME"

# Clean the build dir.
rm -rf "$build_dir"
mkdir -p "$build_dir"

echo "Loading release tool"
release_gopath="$HOME/release_gopath"
GOPATH="$release_gopath" "$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
release_bin="$release_gopath/bin/release"

# The release tool wants GITHUB_TOKEN in the environment. Load it in. The
# test_all_credentials.sh script checks that this file exists.
export GITHUB_TOKEN="$(cat ~/.github_token)"

# NB: This is duplicated in packaging/prerelease/build_app.sh.
if [ ! "${NOWAIT:-}" = "1" ]; then
  echo "Checking client CI"
  "$release_bin" wait-ci --repo="client" --commit="$(git -C $client_dir rev-parse HEAD)" --context="continuous-integration/jenkins/branch" --context="ci/circleci"
  if [ "$mode" != "production" ] ; then
    echo "Checking kbfs CI"
    "$release_bin" wait-ci --repo="kbfs" --commit="$(git -C $kbfs_dir rev-parse HEAD)" --context="continuous-integration/jenkins/branch"
  fi
fi

# Build all the packages!
"$here/build_binaries.sh" "$mode" "$build_dir"
version="$(cat "$build_dir/VERSION")"
"$here/deb/layout_repo.sh" "$build_dir"
"$here/rpm/layout_repo.sh" "$build_dir"

# Short-circuit devel mode.
if [ "$mode" = "devel" ] ; then
  echo "Devel mode does not push. Quitting."
  exit
elif [ "$mode" != "prerelease" ] ; then
  echo "Only the 'prerelease' mode is supported now."
  exit 1
fi

echo Doing a prerelease push to S3...

# Parse the shared .s3cfg file and export the keys as environment variables.
# (Our s3cmd commands would be happy to read that file directly if we put it
# in /root, but the s3_index.sh script ends up running Go code that depends
# on the variables.)
export AWS_ACCESS_KEY="$(grep access_key ~/.s3cfg | awk '{print $3}')"
export AWS_SECRET_KEY="$(grep secret_key ~/.s3cfg | awk '{print $3}')"

# Upload both repos to S3.
echo Syncing the deb repo...
s3cmd sync --add-header="Cache-Control:max-age=60" --delete-removed "$build_dir/deb_repo/repo/" "s3://$BUCKET_NAME/deb/"
echo Syncing the rpm repo...
s3cmd sync --add-header="Cache-Control:max-age=60" --delete-removed "$build_dir/rpm_repo/repo/" "s3://$BUCKET_NAME/rpm/"

# For each .deb and .rpm file we just uploaded, unset the Cache-Control
# header (because these files are large, and they have versioned names), and
# also make a copy in /linux_binaries/{deb,rpm}.
echo Unsetting .deb Cache-Control headers...
dot_deb_blobs="$(s3cmd ls -r "s3://$BUCKET_NAME/deb" | awk '{print $4}' | grep '\.deb$')"
for blob in $dot_deb_blobs ; do
  s3cmd modify --remove-header "Cache-Control" "$blob"
  s3cmd cp "$blob" "s3://$BUCKET_NAME/linux_binaries/deb/"
  s3cmd cp "$blob.sig" "s3://$BUCKET_NAME/linux_binaries/deb/"
done
echo Unsetting .rpm Cache-Control headers...
dot_rpm_blobs="$(s3cmd ls -r "s3://$BUCKET_NAME/rpm" | awk '{print $4}' | grep '\.rpm$')"
for blob in $dot_rpm_blobs ; do
  s3cmd modify --remove-header "Cache-Control" "$blob"
  s3cmd cp "$blob" "s3://$BUCKET_NAME/linux_binaries/rpm/"
  s3cmd cp "$blob.sig" "s3://$BUCKET_NAME/linux_binaries/rpm/"
done

# Make yet another copy of the .deb and .rpm packages we just made, in a
# constant location for the friend-of-keybase instructions. Also make a
# detached signature for each package, to make it easy to verify them by hand.
# Note that these files have slightly different names on the server than they
# do here in the build (x86_64 vs amd64).
another_copy() {
  s3cmd put --follow-symlinks "$1" "$2"
  s3cmd put --follow-symlinks "$1.sig" "$2.sig"
}
another_copy "$build_dir/deb_repo/keybase-latest-amd64.deb" "s3://$BUCKET_NAME/keybase_amd64.deb"
another_copy "$build_dir/deb_repo/keybase-latest-i386.deb" "s3://$BUCKET_NAME/keybase_i386.deb"
another_copy "$build_dir/rpm_repo/keybase-latest-x86_64.rpm" "s3://$BUCKET_NAME/keybase_amd64.rpm"
another_copy "$build_dir/rpm_repo/keybase-latest-i386.rpm" "s3://$BUCKET_NAME/keybase_i386.rpm"

json_tmp=`mktemp`
echo "Writing version into JSON to $json_tmp"

"$release_bin" update-json --version="$version" > "$json_tmp"

s3cmd put --mime-type application/json "$json_tmp" "s3://$BUCKET_NAME/update-linux-prod.json"

# Generate and push the index.html file. S3 pushes in this script can be
# flakey, and on the Linux side of things all this does is update our
# internal pages, so we suppress errors here.
GOPATH="$release_gopath" PLATFORM="linux" "$here/../prerelease/s3_index.sh" || \
  echo "ERROR in s3_index.sh. Internal pages might not be updated. Build continuing..."

"$here/arch/update_aur_packages.sh" "$build_dir"
