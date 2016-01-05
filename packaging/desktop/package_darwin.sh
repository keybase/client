#!/bin/bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd $dir

client_dir="$dir/../.."
build_dir=${BUILD_DIR:-"$dir/build"}
save_dir=${SAVE_DIR:-}
tmp_dir="$dir/tmp"
bucket_name=${BUCKET_NAME:-}
slack_token=${SLACK_TOKEN:-}
slack_channel=${SLACK_CHANNEL:-}
run_mode="prod"
platform="darwin"

s3host=""
if [ ! "$bucket_name" = "" ]; then
  # Use this syntax since bucket_name might have dots (.)
  s3host="https://s3.amazonaws.com/$bucket_name"
fi

# Ensure we have packaging tools
npm install
node_bin="$dir/node_modules/.bin"

app_name=Keybase
keybase_version=""
kbfs_version=""
comment=""

keybase_binpath=${KEYBASE_BINPATH:-}
kbfs_binpath=${KBFS_BINPATH:-}

echo "Loading release tool"
go get github.com/keybase/release
go install github.com/keybase/release
release_bin="$GOPATH/bin/release"

if [ "$keybase_version" = "" ]; then
  if [ ! "$keybase_binpath" = "" ]; then
    keybase_version=`$keybase_binpath version -S`
    echo "Using keybase (bin) version: $keybase_version"
  else
    keybase_version=`$release_bin latest-version --user=keybase --repo=client`
    echo "Using latest keybase version: $keybase_version"
  fi
fi

if [ "$kbfs_version" = "" ]; then
  if [ ! "$kbfs_binpath" = "" ]; then
    kbfs_version=`$kbfs_binpath -version`
    echo "Using kbfs (bin) version: $kbfs_version"
  else
    kbfs_version=`$release_bin latest-version --user=keybase --repo=kbfs-beta`
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
installer_url="https://github.com/keybase/client/releases/download/v1.0.6-0/KeybaseInstaller-1.1.7.tgz"

keybase_bin="$tmp_dir/keybase"
kbfs_bin="$tmp_dir/kbfs"
installer_app="$tmp_dir/KeybaseInstaller.app"

app_version=$keybase_version
dmg_name="${app_name}-${app_version}${comment}.dmg"
zip_name="${app_name}-${app_version}${comment}.zip"
sourcemap_name="${app_name}-${app_version}${comment}.map.zip"

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

  if [ ! "$keybase_binpath" = "" ]; then
    echo "Using local keybase binpath: $keybase_binpath"
    cp $keybase_binpath .
  else
    echo "Getting $keybase_url"
    curl -J -L -Ss $keybase_url | tar zx
  fi

  if [ ! "$kbfs_binpath" = "" ]; then
    echo "Using local kbfs binpath: $kbfs_binpath"
    cp $kbfs_binpath .
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

  npm install
  npm run package -- --appVersion="$app_version" --comment="$comment"
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

update_plist() {
  cd $out_dir
  # App shouldn't display dock icon on startup
  /usr/libexec/plistBuddy -c "Add :LSUIElement bool true" $app_name.app/Contents/Info.plist
  /usr/libexec/plistBuddy -c "Add :NSSupportsSuddenTermination bool true" $app_name.app/Contents/Info.plist
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

create_sourcemap_zip() {
  cd $out_dir
  echo "Creating $sourcemap_name to $client_dir/desktop/dist"
  zip -j $sourcemap_name $client_dir/desktop/dist/*.map
}

create_zip() {
  cd $out_dir
  echo "Creating $zip_name"
  #zip -r $zip_name $app_name.app
  ditto -c -k --sequesterRsrc --keepParent $app_name.app $zip_name
}

s3sync() {
  if [ ! "$bucket_name" = "" ] && [ ! "$save_dir" = "" ]; then
    s3cmd sync --acl-public --disable-multipart $save_dir/* s3://$bucket_name/
  fi
}

save() {
  cd $out_dir
  if [ "$save_dir" = "" ]; then
    echo "Saved files to $out_dir"
  else
    mkdir -p $save_dir
    cd $save_dir
    platform_dir="$save_dir/$platform"
    echo "Saving files to $platform_dir"
    mkdir -p $platform_dir
    mv $out_dir/$dmg_name $platform_dir
    mv $out_dir/$zip_name $platform_dir
  fi

  s3sync

  if [ ! "$s3host" = "" ]; then
    echo "Generating index files..."
    $release_bin update-json --version=$app_version --src="$platform/$zip_name" --uri="$s3host/$platform" > update-$platform-$run_mode.json
    $release_bin index-html --bucket-name="$bucket_name" --prefix="$platform/Keybase-" --suffix=".dmg" --dest="index.html"
    # Sync again with new files
    s3sync
  fi
}

clean
get_deps
package_electron
package_app
update_plist
sign
package_dmg
create_sourcemap_zip
create_zip
save

"$client_dir/packaging/slack/send.sh" "Built $app_version at $s3host/index.html"
