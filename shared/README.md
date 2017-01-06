
**Attention, please.**

This code is a work in progress, and we publish it for full transparency. You can review the source code, but:

 - you shouldn't just run this code without reading it, as it may have bugs or stubbed out crypto
 - it might not do exactly what it says it is doing

If you really want to install Keybase, please return to the [top level Readme.md](https://github.com/keybase/client/blob/master/README.md) for official release instructions.

----------

## Keybase

### Project Status

Hi everyone! This folder's code is *not* ready for prime time. Use at your own risk (and never against production!)
We are iterating quickly and a lot of the code is changing every day.

### Install

```sh
yarn install
```

### iOS

```sh
# Build the go keybase.framework
yarn run rn-gobuild-ios

# Open workspace (not xcodeproj)
open ios/Keybase.xcworkspace
```

Then select the target `Keybase` and run.

#### Android

Follow instructions at https://facebook.github.io/react-native/docs/getting-started.html
to install and configure Android.

```sh
# Build the go keybaselib
yarn run rn-gobuild-android

# Install the app on your device
react-native run-android
```

### Troubleshooting

If you run into weird issues with your packager this may be due to a stale cache, run this command to wipe your local cache:

```sh
yarn run rn-packager-wipe-cache
```