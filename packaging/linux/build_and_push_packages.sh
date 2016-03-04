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

# Clean the build dir.
rm -rf "$build_dir"
mkdir -p "$build_dir"

# Build all the packages!
"$here/build_binaries.sh" "$mode" "$build_dir"
version="$(cat "$build_dir/VERSION")"
"$here/deb/layout_repo.sh" "$build_dir"
"$here/rpm/layout_repo.sh" "$build_dir"

# Short-circuit devel mode.
if [ "$mode" = "devel" ] ; then
  echo "Devel mode does not push. Quitting."
  exit
fi

# Two ways to release, server-ops and prerelease (S3).

release_serverops() {
  echo Pushing to server-ops...

  if [ "$mode" = staging ] ; then
    deb_repo="$serverops_dir/prod/linux/deb_staging"
    rpm_repo="$serverops_dir/prod/linux/rpm_staging"
  elif [ "$mode" = production ] ; then
    deb_repo="$serverops_dir/prod/linux/deb"
    rpm_repo="$serverops_dir/prod/linux/rpm"
  else
    echo "WHAT IS '$mode' MODE? (╯°□°）╯︵ ┻━┻)"
    exit 1
  fi

  "$here/../check_status_and_pull.sh" "$serverops_dir"
  mkdir -p "$serverops_dir/prod/linux"
  rm -rf "$deb_repo"
  cp -r "$build_dir/deb_repo" "$deb_repo"
  rm -rf "$rpm_repo"
  cp -r "$build_dir/rpm_repo" "$rpm_repo"
  git -C "$serverops_dir" add -A
  git -C "$serverops_dir" commit -m "new Linux $mode packages, version $version"
  git -C "$serverops_dir" push

  echo "DON'T FORGET THE LAST STEP! ssh into dist and run:"
  echo "  cd src/keybase/server_ops"
  echo "  git pull"
}

release_prerelease() {
  echo Doing a prerelease push to S3...

  # Parse the shared .s3cfg file and export the keys as environment variables.
  # (Our s3cmd commands would be happy to read that file directly if we put it
  # in /root, but the s3_index.sh script ends up running Go code that depends
  # on the variables.)
  export AWS_ACCESS_KEY="$(grep access_key ~/.s3cfg | awk '{print $3}')"
  export AWS_SECRET_KEY="$(grep secret_key ~/.s3cfg | awk '{print $3}')"

  # Upload both repos to S3.
  echo Syncing the deb repo...
  s3cmd sync --delete-removed "$build_dir/deb_repo/repo/" "s3://$BUCKET_NAME/deb/"
  echo Syncing the rpm repo...
  s3cmd sync --delete-removed "$build_dir/rpm_repo/repo/" "s3://$BUCKET_NAME/rpm/"

  # Upload another copy of the packages to our list of all packages.
  for f in "$build_dir"/deb_repo/repo/pool/main/*/*/*.deb ; do
    echo "Uploading individual binary '$f'..."
    s3cmd put "$f" "s3://$BUCKET_NAME/linux_binaries/deb/"
  done
  for f in "$build_dir"/rpm_repo/repo/*/*.rpm ; do
    echo "Uploading individual binary '$f'..."
    s3cmd put "$f" "s3://$BUCKET_NAME/linux_binaries/rpm/"
  done

  json_tmp=`mktemp`
  echo "Writing version into JSON to $json_tmp"
  cat > "$json_tmp" <<END
{
"version": "$version",
"name": "v$version",
"description": "Latest Linux release",
"type": 0
}
END

  s3cmd put --mime-type application/json "$json_tmp" "s3://$BUCKET_NAME/update-linux-prod.json"

  # Generate and push the index.html file.
  export GOPATH="$HOME/s3_gopath"  # for building the Go release binary
  "$here/../prerelease/s3_index.sh"
}

if [ "$mode" = "prerelease" ] ; then
  release_prerelease
else
  release_serverops
fi
