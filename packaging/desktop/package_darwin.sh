#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

client_dir="$dir/../.."
build_dir=${BUILD_DIR:-"$dir/build"}
save_dir=${SAVE_DIR:-}
tmp_dir="$dir/tmp"

# Ensure we have packaging tools
npm install
node_bin="$dir/node_modules/.bin"

app_name=Keybase
keybase_version=""
kbfs_version=""
comment=""

KEYBASE_BINPATH=${KEYBASE_BINPATH:-}
KBFS_BINPATH=${KBFS_BINPATH:-}

echo "Loading release tool"
go install github.com/keybase/client/go/tools/release
release_bin="$GOPATH/bin/release"

if [ "$keybase_version" = "" ]; then
  if [ ! "$KEYBASE_BINPATH" = "" ]; then
    keybase_version=`$KEYBASE_BINPATH version -S`
    echo "Using keybase (bin) version: $keybase_version"
  else
    keybase_version=`$release_bin --repo=client latest-version`
    echo "Using latest keybase version: $keybase_version"
  fi
fi

if [ "$kbfs_version" = "" ]; then
  if [ ! "$KBFS_BINPATH" = "" ]; then
    kbfs_version=`$KBFS_BINPATH -version`
    echo "Using kbfs (bin) version: $kbfs_version"
  else
    kbfs_version=`$release_bin --repo=kbfs-beta latest-version`
    echo "Using latest kbfs-beta version: $kbfs_version"
  fi
fi

if [ "$keybase_version" = "" ]; then
  echo "No keybase version available"
  exit 1
fi

if [ "$kbfs_version" = "" ]; then
  echo "No kbfs version available"
  exit 1
fi

# if [ "$comment" = "" ]; then
#   comment=`git rev-parse --short HEAD`
#   echo "Using comment: $comment"
# fi
# comment="+$comment"

out_dir="$build_dir/Keybase-darwin-x64"
shared_support_dir="$out_dir/Keybase.app/Contents/SharedSupport"
resources_dir="$out_dir/Keybase.app/Contents/Resources/"

keybase_url="https://github.com/keybase/client/releases/download/v$keybase_version/keybase-$keybase_version-darwin.tgz"
kbfs_url="https://github.com/keybase/kbfs-beta/releases/download/v$kbfs_version/kbfs-$kbfs_version-darwin.tgz"
installer_url="https://github.com/keybase/client/releases/download/v1.0.5-6/KeybaseInstaller-1.1.1.tgz"

keybase_bin="$tmp_dir/keybase"
kbfs_bin="$tmp_dir/kbfs"
installer_app="$tmp_dir/KeybaseInstaller.app"

app_version=$keybase_version
dmg_name="${app_name}App-${app_version}${comment}.dmg"
zip_name="${app_name}App-${app_version}${comment}.zip"

clean() {
  echo "Cleaning"
  rm -rf $build_dir
  rm -rf $tmp_dir
  mkdir -p $build_dir
  mkdir -p $tmp_dir
}

get_deps() {
  cd $tmp_dir
  echo "Downloading dependencies"

  if [ ! "$KEYBASE_BINPATH" = "" ]; then
    echo "Using local keybase binpath: $KEYBASE_BINPATH"
    cp $KEYBASE_BINPATH .
  else
    echo "Getting $keybase_url"
    curl -J -L -Ss $keybase_url | tar zx
  fi

  if [ ! "$KBFS_BINPATH" = "" ]; then
    echo "Using local kbfs binpath: $KBFS_BINPATH"
    cp $KBFS_BINPATH .
  else
    echo "Getting $kbfs_url"
    curl -J -L -Ss $kbfs_url | tar zx
  fi
  curl -J -L -Ss $installer_url | tar zx
}

# Build Keybase.app
package_electron() {
  cd $client_dir
  cd desktop

  npm run package appVersion=$app_version comment=$comment
  rsync -av release/darwin-x64/Keybase-darwin-x64 $build_dir
}

# Adds the keybase binaries and Installer.app bundle to Keybase.app
package_app() {
  cd $build_dir
  echo "Copying keybase binaries"
  mkdir -p $shared_support_dir/bin
  cp $keybase_bin $shared_support_dir/bin
  cp $kbfs_bin $shared_support_dir/bin
  echo "Copying installer"
  mkdir -p $resources_dir
  cp -R $installer_app $resources_dir/KeybaseInstaller.app
}

sign() {
  cd $out_dir
  code_sign_identity="Developer ID Application: Keybase, Inc. (99229SGT5K)"
  codesign --verbose --force --deep --timestamp=none --sign "$code_sign_identity" $app_name.app
}

# Create dmg from Keybase.app
package_dmg() {
  cd $out_dir
  appdmg="appdmg.json"

  osx_installer="$client_dir/osx/Install"
  cp $osx_installer/appdmg/$appdmg .
  cp $osx_installer/appdmg/Background.png .
  cp $osx_installer/appdmg/Keybase.icns .

  rm -rf $dmg_name
  $node_bin/appdmg $appdmg $dmg_name
}

create_zip() {
  cd $out_dir
  echo "Creating $zip_name"
  #zip -r $zip_name $app_name.app
  ditto -c -k --sequesterRsrc --keepParent $app_name.app $zip_name
}

save() {
  cd $out_dir
  if [ ! "$save_dir" = "" ]; then
    mkdir -p $save_dir
    echo "Saved files to $save_dir"
    mv $dmg_name $save_dir
    mv $zip_name $save_dir
  else
    echo "Saved files to $out_dir"
  fi
}

clean
get_deps
package_electron
package_app
#TEMP sign
package_dmg
create_zip
save
