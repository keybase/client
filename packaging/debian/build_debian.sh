#! /bin/bash

# Builds the keybase binary and packages it into two ".deb" files, one for i386
# and one for amd64. Takes a build directory as an argument, or creates one in
# /tmp. The package files are created there, in their respective folders.
#
# Usage:
#   ./build_debian.sh (production|prerelease|devel) [build_dir]

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

mode="$("$here/../build_mode.sh" "$@")"
binary_name="$("$here/../binary_name.sh" "$@")"

# Take the second argument as the build root, or a tmp dir if there is no first
# argument.
build_root="${2:-$(mktemp -d)}"

echo "Building $mode mode in $build_root"

install_electron_dependencies() {
  echo "Installing Node modules for Electron"
  # Can't seem to get the right packages installed under NODE_ENV=production.
  export NODE_ENV=development
  (cd "$here/"../../react-native && npm i)
  (cd "$here/"../../desktop && npm i)
  export NODE_ENV=production
}

current_date=`date -u +%Y%m%d%H%M%S` # UTC

###
### TODO: Factor all of this out. Add a config for enabling the KBFS/GUI build.
###
build_one_architecture() {
  echo "building Go client for $GOARCH"
  dest="$build_root/$debian_arch"
  mkdir -p "$dest/build/usr/bin"
  mkdir -p "$dest/build/DEBIAN"
  mkdir -p "$dest/build/opt/keybase"

  # `go build` reads $GOARCH
  # XXX: Go does not build tags reliably prior to 1.5 without -a. See:
  #      https://github.com/golang/go/issues/11165
  commit_short=`git -C "$here" log -1 --pretty=format:%h`
  build="$current_date+$commit_short"
  keybase_build=${KEYBASE_BUILD:-$build}
  if [ "$mode" = "prerelease" ] ; then
    echo building PRERELEASE
    tags=${TAGS:-"prerelease production"}
    ldflags="-X github.com/keybase/client/go/libkb.CustomBuild=$keybase_build"
  else
    echo building regular release
    tags=${TAGS:-"production"}
    ldflags=""
  fi
  platform=${PLATFORM:-`uname`}
  echo "The build id is '$keybase_build'."
  echo "The custom ldflags are '$ldflags'."
  go build -a -tags "$tags" -ldflags "$ldflags" -o "$dest/build/usr/bin/$binary_name" github.com/keybase/client/go/keybase

  if [ "$mode" = "prerelease" ] ; then
    cp "$here/run_keybase.sh" "$dest/build/usr/bin/run_keybase.sh"

    # Build KBFS.
    go build -a -tags "$tags" -ldflags "$ldflags" -o "$dest/build/usr/bin/kbfsfuse" github.com/keybase/kbfs/kbfsfuse
    # Now the Electron build.
    echo "Building Electron client for $electron_arch"
    (cd "$here"/../../desktop && node package.js --platform linux --arch $electron_arch)
    (cd "$here"/../../desktop && rsync -a "release/linux-${electron_arch}/Keybase-linux-${electron_arch}/" "$dest/build/opt/keybase")
    # Create the /keybase mount point.
    mount_point="$dest/build/keybase"
    mkdir "$mount_point"
    chmod 777 "$mount_point"
  fi

  # Installed-Size is a required field in the control file. Without it Ubuntu
  # users will see warnings.
  size="$(du --summarize --block-size=1024 "$dest/build" | awk '{print $1}')"

  version="$("$here/../version.sh")"
  joint_version="$version-$keybase_build"
  echo "Version is $joint_version"
  cat "$here/control.template" \
    | sed "s/@@NAME@@/$binary_name/" \
    | sed "s/@@VERSION@@/$joint_version/" \
    | sed "s/@@ARCHITECTURE@@/$debian_arch/" \
    | sed "s/@@SIZE@@/$size/" \
    > "$dest/build/DEBIAN/control"
  cp "$here/postinst" "$dest/build/DEBIAN/"

  fakeroot dpkg-deb --build "$dest/build" "$dest/$binary_name.deb"

  # Write the version number to a file for the caller's convenience.
  echo -n "$version" > "$dest/VERSION"
}

# Note that Go names the x86 architecture differently than Debian does, which
# is why we need these two variables.

if [ -n "${KEYBASE_INCLUDE_KBFS:-}" ] ; then
  install_electron_dependencies
fi

export GOARCH=amd64
export debian_arch=amd64
export electron_arch=x64
build_one_architecture

export GOARCH=386
export debian_arch=i386
export electron_arch=ia32
build_one_architecture
