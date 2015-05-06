# Keybase for Mac OS X

## Installer

To generate Keybase.app installer, see the [Installer](https://github.com/keybase/client/tree/master/osx/Install/README.md). For updater info see the [Updater](https://github.com/keybase/client/tree/master/osx/Install/Updater/README.md).

## Xcode

```sh
# Install CocoaPods (if not installed)
sudo gem install cocoapods
pod setup

# Generate workspace
pod install

# Open workspace (not xcodeproj)
open Keybase.xcworkspace
```

Then select the target ```Keybase``` and run.
