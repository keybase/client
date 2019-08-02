
**Attention, please.**

This code is a work in progress, and we publish it for full transparency. You can review the source code, but:

 - you shouldn't just run this code without reading it, as it may have bugs or stubbed out crypto
 - it might not do exactly what it says it is doing

If you really want to install Keybase, please return to the [top level Readme.md](https://github.com/keybase/client/blob/master/README.md) for official release instructions.

----------

## Keybase

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
| KEYBASE_RUN_MODE | Run mode: prod, staging, devel |
| NO_DASHBOARD | Don't show dashboard |

You can also edit `~/Library/Logs/Keybase.app.debug` on macOS,
`$HOME/.cache/keybase.app.debug` on Linux, or
`%localappdata%\Keybase\keybase.app.debug` on Windows (see
`platform.desktop.js`) to add debug flags. In particular, you probably want
```json
{
  "showDevTools": true
}
```
instead of toggling the dev tools after launch because of a bug where
not all source files are available if the dev tools aren't opened at launch.

### Debugging with React Developer Tools and Immutable.js Object Formatter extensions

1) Install the [React Developer
Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
and the [Immutable.js Object
Formatter](https://chrome.google.com/webstore/detail/immutablejs-object-format/hgldghadipiblonfkkicmgcbbijnpeog)
extensions in your regular Chrome browser.
2) Set the following environment variables and make sure
`KEYBASE_PERF` is unset. If you're using fish shell on macOS:

```
set -e KEYBASE_PERF
set -x KEYBASE_LOCAL_DEBUG 1
set -x KEYBASE_DEV_TOOL_ROOTS "$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi,$HOME/Library/Application Support/Google/Chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

If you're using fish shell on Linux:

```
set -e KEYBASE_PERF
set -x KEYBASE_LOCAL_DEBUG 1
set -x KEYBASE_DEV_TOOL_ROOTS "$HOME/.config/google-chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi,$HOME/.config/google-chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

If you're using bash on macOS:

```
unset KEYBASE_PERF
export KEYBASE_LOCAL_DEBUG=1
export KEYBASE_DEV_TOOL_ROOTS="$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi,$HOME/Library/Application Support/Google/Chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

If you're using bash on Linux:

```
unset KEYBASE_PERF
export KEYBASE_LOCAL_DEBUG=1
export KEYBASE_DEV_TOOL_ROOTS="$HOME/.config/google-chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi,$HOME/.config/google-chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

(See [this code](https://github.com/keybase/client/blob/master/shared/desktop/yarn-helper/electron.js#L47) for details.)

3) Run `yarn run start-hot`.

If you're running Chromium instead of Google Chrome, or if you've
installed the extension in your non-default browser, you'll have to
change the path passed to `KEYBASE_DEV_TOOL_ROOTS`.

If for some reason you don't want to use `start-hot`, you'll have to
set `KEYBASE_DEV_TOOL_EXTENSIONS` instead of `KEYBASE_DEV_TOOL_ROOTS`,
and you'll have to use the version subdirectory:

```
set -x KEYBASE_DEV_TOOL_EXTENSIONS "$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/2.5.2_0,$HOME/Library/Application Support/Google/Chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog/1.7_0"
```

Note that this means you'll have to change the last path component if
Chrome updates the extension, which can happen at any time. (See [this
code](https://github.com/keybase/client/blob/7e9ad67c0f86a82649f2e81586986892adcdf6fa/shared/desktop/app/dev-tools.js)
and [the Electron
docs](https://electron.atom.io/docs/tutorial/devtools-extension/) for
details.)

Then you can run, e.g. `yarn run start`.

4) Make sure to check 'Enable custom formatters' in the DevTools settings for Immutable.js Object Formatter.

## Android
see [Android Docs](docs/android/overview.md)

### iOS
see [iOS docs](./docs/ios/running.md)

### Troubleshooting

#### Android
[Android Troubleshooting](docs/react-native/running.md#troubleshooting)

#### React Native
[React Native Troubleshooting](docs/react-native/troubleshooting.md)

### Updating `react-native`

Look at [this page](https://react-native-community.github.io/upgrade-helper/) to help see what you need to change locally

### Updating `electron`

We host the electron binaries used for our build process in keybase.pub. If you update versions copy files from https://github.com/electron/electron/releases/ to https://keybase.pub/kbelectron/electron-download/v{version}. Make sure to get the SHASUM256.txt file also. This only affects the build machines

## Storybook

The app uses [storybook](https://storybook.js.org/) snapshots. If you make a change that changes the html output of a story, tests will catch the difference.

To update the stories, first determine which stories changed. Run the tests `yarn test Storyshots` and look for lines containing '●':

Run the local storybook server. Verify that the affected stories look correct.

```
yarn storybook
```

To update the snapshot file run:

```
yarn test -u Storyshots
```

## Misc

### Updating the list of countries with SMS support

In order to update the list of countries supported by Amazon SNS, run
the [update-data.sh](https://github.com/keybase/client/blob/master/shared/util/phone-numbers/sms-support/update-data.sh)
script. It will first fetch the JSON from Amazon's public S3 bucket and
transform it for use in our internal country filtering code.
