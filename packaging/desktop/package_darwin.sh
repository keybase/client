#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "$dir"

client_dir="$dir/../.."
shared_dir="$client_dir/shared"
desktop_dir="$client_dir/shared/desktop"
build_dir=${BUILD_DIR:-"/tmp/package_darwin/build"}
save_dir=${SAVE_DIR:-}
tmp_dir="/tmp/package_darwin/tmp"
bucket_name=${BUCKET_NAME:-}
run_mode="prod"
s3host=${S3HOST:-}
istest=${TEST:-}
skip_notarize=${SKIP_NOTARIZE:-}
arch=${ARCH:-"amd64"}
electron_arch="x64"
platform=${PLATFORM:-"darwin"}
if [ "$arch" = "arm64" ]; then
  electron_arch="arm64"
fi

if [ ! "$bucket_name" = "" ] && [ "$s3host" = "" ]; then
  # Use this syntax since bucket_name might have dots (.)
  s3host="https://s3.amazonaws.com/$bucket_name"
fi

echo "Cleaning up packaging dir from previous runs"
rm -rf "$dir/node_modules"

# Ensure we have packaging tools
yarn install --pure-lockfile --ignore-engines
node_bin="$dir/node_modules/.bin"

app_name=Keybase
keybase_version=${KEYBASE_VERSION:-}
kbnm_version=${KBNM_VERSION:-}
kbfs_version=${KBFS_VERSION:-}
comment=""

keybase_binpath=${KEYBASE_BINPATH:-}
git_remote_keybase_binpath=${GIT_REMOTE_KEYBASE_BINPATH:-}
kbfs_binpath=${KBFS_BINPATH:-}
redirector_binpath=${REDIRECTOR_BINPATH:-$(dirname "$KBFS_BINPATH")/keybase-redirector}
kbnm_binpath=${KBNM_BINPATH:-}
updater_binpath=${UPDATER_BINPATH:-}

icon_path="$client_dir/media/icons/Keybase.icns"
saltpack_icon="$client_dir/media/icons/saltpack.icns"

echo "Loading release tool"
(cd "$client_dir/go/buildtools"; go install "github.com/keybase/client/go/release")
release_bin="$GOPATH/bin/release"
echo "$(go version)"

if [ "$keybase_version" = "" ]; then
  if [ ! "$keybase_binpath" = "" ]; then
    keybase_version=$($keybase_binpath version -S)
    echo "Using keybase (bin) version: $keybase_version"
  fi
fi

if [ "$kbfs_version" = "" ]; then
  if [ ! "$kbfs_binpath" = "" ]; then
    kbfs_version=$($kbfs_binpath -version)
    echo "Using kbfs (bin) version: $kbfs_version"
  fi
fi

if [ "$kbnm_version" = "" ]; then
  if [ ! "$kbnm_binpath" = "" ]; then
    kbnm_version=$($kbnm_binpath -version)
    echo "Using kbnm (bin) version: $kbnm_version"
  fi
fi

if [ "$keybase_version" = "" ]; then
  echo "Specify KEYBASE_VERSION to use (Github release/tag)"
  exit 1
fi

if [ "$kbfs_version" = "" ]; then
  echo "Specify KBFS_VERSION for use (Github release/tag)"
  exit 1
fi

if [ "$kbnm_version" = "" ]; then
  # TODO: Make KBNM_VERSION be injected during build.
  kbnm_version="$keybase_version"
  echo "KBNM_VERSION unspecified, defaulting to: $kbnm_version"
fi

if [ "$arch" = "amd64" ]; then
  out_dir="$build_dir/Keybase-darwin-x64"
elif [ "$arch" = "arm64" ]; then
  out_dir="$build_dir/Keybase-darwin-arm64"
else
  echo "unknown arch for packaging: $arch"
  exit 1
fi

echo "packaging in out_dir: $out_dir"

app_executable_path="$out_dir/Keybase.app/Contents/MacOS/Keybase"
shared_support_dir="$out_dir/Keybase.app/Contents/SharedSupport"
resources_dir="$out_dir/Keybase.app/Contents/Resources/"

# TODO build and publish an arm64 version
# The KeybaseInstaller.app installs KBFuse, keybase.Helper, services and CLI via a native app
installer_url="https://prerelease.keybase.io/darwin-package/KeybaseInstaller-1.1.93-darwin.tgz"
# KeybaseUpdater.app is the native updater UI (prompt dialogs)
updater_url="https://prerelease.keybase.io/darwin-package/KeybaseUpdater-1.0.7-darwin.tgz"

keybase_bin="$tmp_dir/keybase"
git_remote_keybase_bin="$tmp_dir/git-remote-keybase"
redirector_bin="$tmp_dir/keybase-redirector"
kbfs_bin="$tmp_dir/kbfs"
kbnm_bin="$tmp_dir/kbnm"
updater_bin="$tmp_dir/updater"
installer_app="$tmp_dir/KeybaseInstaller.app"
updater_app="$tmp_dir/KeybaseUpdater.app"

app_version="$keybase_version"
dmg_name="${app_name}-${app_version}${comment}.dmg"
zip_name="${app_name}-${app_version}${comment}.zip"
sourcemap_name="${app_name}-${app_version}${comment}.map.zip"
sig_name="${app_name}-${app_version}${comment}.sig"
update_json_name="update-${platform}-${run_mode}-${app_version}.json"

clean() {
  echo "Cleaning"
  rm -rf "$build_dir"
  rm -rf "$tmp_dir"
  mkdir -p "$build_dir"
  mkdir -p "$tmp_dir"
}

ensure_url() {
  url="$1"
  msg="$2"
  if ! curl --output /dev/null --silent --head --fail "$url"; then
    echo "URL doesn't exist: $url"
    echo "$msg"
    exit 1
  fi
}

get_deps() {(
  cd "$tmp_dir"
  echo "Downloading dependencies"

  if [ ! "$keybase_binpath" = "" ]; then
    echo "Using local keybase binpath: $keybase_binpath"
    cp "$keybase_binpath" .
  else
    keybase_url="https://github.com/keybase/client/releases/download/v$keybase_version/keybase-$keybase_version-$platform.tgz"
    echo "Getting $keybase_url"
    ensure_url "$keybase_url" "You need to build the binary for this Github release/version. See packaging/github to create/build a release."
    curl -J -L -Ss "$keybase_url" | tar zx
  fi

  if [ ! "$kbfs_binpath" = "" ]; then
    echo "Using local kbfs binpath: $kbfs_binpath"
    cp "$kbfs_binpath" .
    cp "$git_remote_keybase_binpath" .
    echo "Using local redirector binpath: $redirector_binpath"
    cp "$redirector_binpath" .
  else
    kbfs_url="https://github.com/keybase/client/go/kbfs/releases/download/v$kbfs_version/kbfs-$kbfs_version-$platform.tgz"
    echo "Getting $kbfs_url"
    ensure_url "$kbfs_url" "You need to build the binary for this Github release/version. See packaging/github to create/build a release."
    curl -J -L -Ss "$kbfs_url" | tar zx
  fi

  if [ ! "$kbnm_binpath" = "" ]; then
    echo "Using local kbnm binpath: $kbnm_binpath"
    cp "$kbnm_binpath" .
  else
    kbnm_url="https://github.com/keybase/kbnm/releases/download/v$kbnm_version/kbnm-$kbnm_version-$platform.tgz"
    echo "Getting $kbnm_url"
    ensure_url "$kbnm_url" "You need to build the binary for this Github release/version. See packaging/github to create/build a release."
    curl -J -L -Ss "$kbnm_url" | tar zx
  fi

  echo "Using local updater binpath: $updater_binpath"
  cp "$updater_binpath" .

  echo "Using installer from $installer_url"
  curl -J -L -Ss "$installer_url" | tar zx

  echo "Using updater from $updater_url"
  curl -J -L -Ss "$updater_url" | tar zx
)}

# Build Keybase.app
package_electron() {(
  cd "$shared_dir"

  echo "Cleaning up main node_modules from previous runs"
  rm -rf "$shared_dir/node_modules"

  yarn install --pure-lockfile --ignore-engines
  yarn run package -- --appVersion="$app_version" --comment="$comment" --icon="$icon_path" --saltpackIcon="$saltpack_icon"  --outDir="$build_dir" --arch="$electron_arch"

  # Create symlink for Electron to overcome Gatekeeper bug https://github.com/keybase/client/go/updater/pull/4
  cd "$out_dir/$app_name.app/Contents/MacOS"
  ln -s "Keybase" "Electron"

  if [ ! -f "$app_executable_path" ]; then
    echo "The app bundle executable name should be $app_executable_path"
    exit 1
  fi
)}

# Adds the keybase binaries, app bundles, and icons to Keybase.app
package_app() {(
  cd "$build_dir"
  echo "Copying keybase binaries"
  mkdir -p "$shared_support_dir/bin"
  cp "$keybase_bin" "$shared_support_dir/bin"
  cp "$git_remote_keybase_bin" "$shared_support_dir/bin"
  cp "$redirector_bin" "$shared_support_dir/bin"
  cp "$kbfs_bin" "$shared_support_dir/bin"
  cp "$kbnm_bin" "$shared_support_dir/bin"
  cp "$updater_bin" "$shared_support_dir/bin"
  mkdir -p "$resources_dir"
  echo "Copying icons"
  cp -R "$client_dir/media/icons/KeybaseFolder.icns" "$resources_dir/KeybaseFolder.icns"
  echo "Copying other resources"
  cp -R "$client_dir/osx/Resources/ExtendedAttributeFinderInfo.bin" "$resources_dir/ExtendedAttributeFinderInfo.bin"
  echo "Copying installer"
  cp -R "$installer_app" "$resources_dir/KeybaseInstaller.app"
  echo "Copying updater (app)"
  cp -R "$updater_app" "$resources_dir/KeybaseUpdater.app"
)}

update_plist() {(
  cd "$out_dir"
  # App shouldn't display dock icon on startup
  /usr/libexec/plistBuddy -c "Add :LSUIElement bool true" "$app_name.app/Contents/Info.plist"
)}

sign() {(
  cd "$out_dir"
  code_sign_identity="90524F7BEAEACD94C7B473787F4949582F904104" # "Developer ID Application: Keybase, Inc. (99229SGT5K)"
  # need to sign some stuff from electron that doesn't get picked up for some reason
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" "$app_name.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib"
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" "$app_name.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libEGL.dylib"
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" "$app_name.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libGLESv2.dylib"
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" "$app_name.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Libraries/libvk_swiftshader.dylib"
  codesign --verbose --force --deep --timestamp --options runtime --sign "$code_sign_identity" "$app_name.app/Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt"

  codesign --verbose --force --deep --timestamp --options runtime --entitlements "$client_dir"/osx/Keybase.entitlements --sign "$code_sign_identity" "$app_name.app"



  echo "Verify codesigning..."
  codesign --verify --verbose=4 "$app_name.app"
  spctl --assess --verbose=4 "$app_name.app"
  codesign --verify --verbose=4 "$app_name.app/Contents/SharedSupport/bin/keybase"
  codesign --verify --verbose=4 "$app_name.app/Contents/SharedSupport/bin/git-remote-keybase"
  codesign --verify --verbose=4 "$app_name.app/Contents/SharedSupport/bin/keybase-redirector"
  codesign --verify --verbose=4 "$app_name.app/Contents/SharedSupport/bin/kbfs"
  codesign --verify --verbose=4 "$app_name.app/Contents/SharedSupport/bin/kbnm"
  codesign --verify --verbose=4 "$app_name.app/Contents/SharedSupport/bin/updater"
  bundle_installer_app="$app_name.app/Contents/Resources/KeybaseInstaller.app"
  codesign --verify --verbose=4 "$bundle_installer_app"
  spctl --assess --verbose=4  "$bundle_installer_app"
  bundle_updater_app="$app_name.app/Contents/Resources/KeybaseUpdater.app"
  codesign --verify --verbose=4 "$bundle_updater_app"
  spctl --assess --verbose=4 "$bundle_updater_app"
)}

# Create dmg from Keybase.app
package_dmg() {(
  cd "$out_dir"
  echo "Packaging dmg in $out_dir"
  appdmg="appdmg.json"

  osx_scripts="$client_dir/osx/Scripts"
  cp "$osx_scripts/appdmg/$appdmg" .
  cp "$osx_scripts/appdmg/Background.png" .
  cp "$icon_path" .

  rm -rf "$dmg_name"
  "$node_bin/appdmg" "$appdmg" "$dmg_name"
)}

# Notarize the dmg
notarize_dmg() {(
  cd "$out_dir"
  if [ "$skip_notarize" = "1" ]; then
    echo "Skipping notarize..."
    return
  fi
  echo "Uploading $dmg_name to notarization service in $out_dir"
  xcrun notarytool submit "$out_dir/$dmg_name" --keychain-profile "NOTARY_PROFILE_LOGIN" --wait
  xcrun stapler staple "$out_dir/$dmg_name" 
  echo "Successfully uploaded to notarization service"
)}

create_sourcemap_zip() {(
  cd "$out_dir"
  echo "Creating $sourcemap_name from $desktop_dir/dist"
  zip -j "$sourcemap_name" "$desktop_dir/dist"/*.map
)}

create_zip() {(
  cd "$out_dir"
  echo "Creating $out_dir/$zip_name"
  #zip -r $zip_name $app_name.app
  ditto -c -k --sequesterRsrc --keepParent "$app_name.app" "$zip_name"
)}

kbsign() {(
  cd "$out_dir"
  echo "Signing (via keybase)"
  # Use saltpack v1 because keybase/go-updater supports that version
  keybase sign -d --saltpack-version=1 -i "$zip_name" -o "$sig_name"
)}

update_json() {(
  cd "$out_dir"
  if [ -n "$s3host" ]; then
    echo "Generating $update_json_name"
    "$release_bin" update-json --version="$app_version" --src="$zip_name" \
      --uri="$s3host/$platform-updates" --signature="$out_dir/$sig_name" --description="$desktop_dir/CHANGELOG.txt" > "$update_json_name"
  fi
)}

save() {(
  cd "$out_dir"
  if [ "$save_dir" = "" ]; then
    echo "Saved files to $out_dir"
    return
  fi
  mkdir -p "$save_dir"
  cd "$save_dir"
  platform_dir="$save_dir/$platform"
  if [ "$istest" = "1" ]; then
    platform_dir="$save_dir/${platform}-test"
  fi
  echo "Saving files to $platform_dir"
  # DMG
  mkdir -p "$platform_dir"
  mv "$out_dir/$dmg_name" "$platform_dir"
  # Zip
  mkdir -p "$platform_dir-updates"
  mv "$out_dir/$zip_name" "$platform_dir-updates"
  # Sourcemap
  mkdir -p "$save_dir/electron-sourcemaps"
  mv "$out_dir/$sourcemap_name" "$save_dir/electron-sourcemaps"
  # Support files
  mkdir -p "$platform_dir-support"
  mv "$out_dir/$update_json_name" "$platform_dir-support"
)}

s3sync() {
  if [ ! "$bucket_name" = "" ] && [ ! "$save_dir" = "" ]; then
    s3cmd sync --acl-public --disable-multipart "$save_dir"/* s3://"$bucket_name"/
  else
    echo "S3 sync disabled"
  fi
}

clean
get_deps
package_electron
package_app
update_plist
sign
package_dmg
notarize_dmg
create_sourcemap_zip
create_zip
kbsign
update_json
save
s3sync
