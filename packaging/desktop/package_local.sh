#!/bin/sh

set -e # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

build_dir="$dir/build"
tmp_dir="$dir/tmp"

app_name=Keybase

out_dir="$build_dir/Keybase-darwin-x64"
shared_support_dir="$out_dir/Keybase.app/Contents/SharedSupport"
resources_dir="$out_dir/Keybase.app/Contents/Resources/"

keybase_bin="$GOPATH/bin/keybase"
kbfs_bin="$GOPATH/bin/kbfs"
installer_app="$tmp_dir/KeybaseInstaller.app"

app_version=`$keybase_bin version -S`

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

create_zip() {
  cd $out_dir
  zip_name="$app_name-$app_version.zip"
  echo "Creating $zip_name"
  zip -r $zip_name $app_name.app
}

package_app
sign
create_zip
