
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

### Desktop

The following `yarn run` commands, to build, run or package the app:

| Command | Description |
|---------|-------------|
| start | Build a development bundle and start app |
| hot-server | Start the hot-reloading server |
| start-hot | Connect to a hot-reloading server (If you're developing and want to see changes as you make them) |
| build-dev | Build development bundle |
| build-prod | Build prod bundle |
| package | Package app |


You can set environment variables for debugging:

| Env     | Description |
|---------|-------------|
| KEYBASE_RUN_MODE | Run mode: production, staging, devel |
| KEYBASE_LOCAL_DEBUG | For debugging |
| KEYBASE_SHOW_DEVTOOLS | Show devtools |
| KEYBASE_FEATURES | Feature flags |
| KEYBASE_RPC_DELAY | Number of ms to delay all RPC calls (requires debug mode) |
| KEYBASE_RPC_DELAY_RESULT | Number of ms to delay all RPC call callbacks (requires debug mode) |
| NO_DASHBOARD | Don't show dashboard |

### iOS

```sh
# Build the go keybase.framework
yarn run rn-gobuild-ios

# Open workspace (not xcodeproj)
open react-native/ios/Keybase.xcworkspace
```

Then select the target `Keybase` and run.

### Android

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

This PR should tag react-hackers automatically.
