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

export BUCKET_NAME="${BUCKET_NAME:-prerelease.keybase.io}"
echo "Using BUCKET_NAME $BUCKET_NAME"

# Clean the build dir.
rm -rf "$build_dir"
mkdir -p "$build_dir"

echo "Checking CI for this commit"
(
  temp="$(mktemp -d)"
  (cd "$temp" && npm i github-ci-status)
  (cd "$client_dir" && "$temp/node_modules/.bin/ci" --required-tests 3)
  rm -r "$temp"
)

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
  echo "  cd src/keybase/server-ops"
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
  done
  echo Unsetting .rpm Cache-Control headers...
  dot_rpm_blobs="$(s3cmd ls -r "s3://$BUCKET_NAME/rpm" | awk '{print $4}' | grep '\.rpm$')"
  for blob in $dot_rpm_blobs ; do
    s3cmd modify --remove-header "Cache-Control" "$blob"
    s3cmd cp "$blob" "s3://$BUCKET_NAME/linux_binaries/rpm/"
  done

  # Make yet another copy of the .deb and .rpm packages we just made, in a
  # constant location for the friend-of-keybase instructions.
  s3cmd put --follow-symlinks "$build_dir/deb_repo/keybase-latest-amd64.deb" "s3://$BUCKET_NAME/keybase_amd64.deb"
  s3cmd put --follow-symlinks "$build_dir/deb_repo/keybase-latest-i386.deb" "s3://$BUCKET_NAME/keybase_i386.deb"
  s3cmd put --follow-symlinks "$build_dir/rpm_repo/keybase-latest-x86_64.rpm" "s3://$BUCKET_NAME/keybase_amd64.rpm"
  s3cmd put --follow-symlinks "$build_dir/rpm_repo/keybase-latest-i386.rpm" "s3://$BUCKET_NAME/keybase_i386.rpm"

  json_tmp=`mktemp`
  echo "Writing version into JSON to $json_tmp"

  echo "Loading release tool"
  export GOPATH="$HOME/s3_gopath"  # for building the Go release binary
  "$client_dir/packaging/goinstall.sh" "github.com/keybase/release"
  release_bin="$GOPATH/bin/release"

  "$release_bin" update-json --version="$version" --description="Latest Linux release" > "$json_tmp"

  s3cmd put --mime-type application/json "$json_tmp" "s3://$BUCKET_NAME/update-linux-prod.json"

  # Generate and push the index.html file. S3 pushes in this script can be
  # flakey, and on the Linux side of things all this does is update our
  # internal pages, so we suppress errors here.
  PLATFORM="linux" "$here/../prerelease/s3_index.sh" || \
    echo "ERROR in s3_index.sh. Internal pages might not be updated. Build continuing..."

  echo Exporting to kbfs-beta...
  "$client_dir/packaging/export/export_kbfs.sh"

  bump_arch_linux_aur
}

bump_arch_linux_aur() {
  # This relies on having the SSH key registered with the "keybase" account on
  # https://aur.archlinux.org.
  (
    arch_version="$("$here/arch/version.sh")"
    temp_repo=`mktemp -d`
    git clone aur@aur.archlinux.org:keybase-git "$temp_repo"
    cd "$temp_repo"
    sed -i "s/pkgver=.*/pkgver=$arch_version/" PKGBUILD
    sed -i "s/pkgver = .*/pkgver = $arch_version/" .SRCINFO
    # The commit will fail if there are no changes. Don't push in that case.
    if git commit -am "version bump" ; then
      git push origin master
    else
      echo "No changes to the PKGBUILD. Skipping AUR push."
    fi
  )
}

if [ "$mode" = "prerelease" ] ; then
  release_prerelease
else
  release_serverops
fi
