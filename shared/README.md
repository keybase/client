
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

If you get this error in the React Packager:

```
React packager ready.

Loading dependency graph...2017-08-01 23:06 node[58084] (FSEvents.framework) FSEventStreamStart: register_with_server: ERROR: f2d_register_rpc() => (null) (-22)
2017-08-01 23:06 node[58084] (FSEvents.framework) FSEventStreamStart: register_with_server: ERROR: f2d_register_rpc() => (null) (-22)
2017-08-01 23:06 node[58084] (FSEvents.framework) FSEventStreamStart: register_with_server: ERROR: f2d_register_rpc() => (null) (-22)
 ERROR  Error watching file for changes: EMFILE
{"code":"EMFILE","errno":"EMFILE","syscall":"Error watching file for changes:","filename":null}
Error: Error watching file for changes: EMFILE
    at exports._errnoException (util.js:1024:11)
    at FSEvent.FSWatcher._handle.onchange (fs.js:1359:9)
Loading dependency graph...Process terminated. Press <enter> to close the window
```

the easiest way to fix it is simply to install watchman:

```
brew install watchman
```

### Android

Follow instructions at https://facebook.github.io/react-native/docs/getting-started.html
to install and configure Android.

```sh
# Build the go keybaselib
yarn run rn-gobuild-android

# Install the app on your device
react-native run-android
```

### Debugging with React Developer Tools extension

1) Install the [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) in your regular Chrome browser.
2) Set the following environment variables and make sure `KEYBASE_PERF` is unset (assuming you're using fish shell):

```
set -e KEYBASE_PERF
set -x KEYBASE_LOCAL_DEBUG 1
set -x KEYBASE_DEV_TOOL_ROOTS "$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi"
```

(You may also want `set -x KEYBASE_SHOW_DEVTOOLS 1`.)

(See [this code](https://github.com/keybase/client/blob/master/shared/desktop/yarn-helper/electron.js#L47) for details.)

3) Run `yarn run start-hot`.

If you're running Chromium instead of Google Chrome, or if you've
installed the extension in your non-default browser, you'll have to
change the path passed to `KEYBASE_DEV_TOOL_ROOTS`.

If for some reason you don't want to use `start-hot`, you'll have to
set `KEYBASE_DEV_TOOL_EXTENSIONS` instead of `KEYBASE_DEV_TOOL_ROOTS`,
and you'll have to use the version subdirectory:

```
set -x KEYBASE_DEV_TOOL_EXTENSIONS "$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/2.5.0_0"
```

Note that this means you'll have to change the last path component if
the extension gets
updated. (See
[this code](https://github.com/keybase/client/blob/7e9ad67c0f86a82649f2e81586986892adcdf6fa/shared/desktop/app/dev-tools.js) and
[the Electron docs](https://electron.atom.io/docs/tutorial/devtools-extension/) for
details.)

Then you can run, e.g. `yarn run start`.

### Troubleshooting

If you run into weird issues with your packager this may be due to a stale cache, run this command to wipe your local cache:

```sh
yarn run rn-packager-wipe-cache
```

### Dependency forks

We have some custom forks of dependencies. This is usually a temporary fix and is something we want to avoid long term.

- react-native-image-picker: Doesn't support React Native 0.47
- react-native-push-notification: Handle notification data from intent extras in onNewIntent. Remove hasPoppedInitialNotification flag
- react-navigation: Fix queued transition being dropped if interrupted. Add screen option to allow interactivity during transition
- electron-download: Make cache configurable via env vars
- fs-extra: Workaround for problems w/ webpack
