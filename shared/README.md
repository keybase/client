**Attention, please.**

This code is a work in progress, and we publish it for full transparency. You can review the source code, but:

- you shouldn't just run this code without reading it, as it may have bugs or stubbed out crypto
- it might not do exactly what it says it is doing

If you really want to install Keybase, please return to the [top level Readme.md](https://github.com/keybase/client/blob/master/README.md) for official release instructions.

---

## Keybase

### Install

Run within the `shared/` directory to setup our dependencies:

```sh
yarn modules
```

### Desktop

The following `yarn run` commands, to build, run or package the app:

| Command    | Description                                         |
| ---------- | --------------------------------------------------- |
| start      | Build a development bundle and start app            |
| hot-server | Start the hot-reloading server (with start-hot)     |
| start-hot  | Connect to a hot-reloading server (with hot-server) |
| build-dev  | Build development bundle                            |
| build-prod | Build prod bundle                                   |
| package    | Package app                                         |

You can set environment variables for debugging:

| Env                   | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| KEYBASE_RUN_MODE      | Run mode: prod, staging, devel                                                  |
| KEYBASE_DEVEL_USE_XDG | Force Keybase to use XDG paths, can fix service socket location issues on Linux |

You can also edit `~/Library/Logs/Keybase.app.debug` on macOS,
`$HOME/.cache/keybase/keybase.app.debug` on Linux, or
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

1. Install the [React Developer
   Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
2. Set the following environment variables

If you're using bash on macOS:

```
export KEYBASE_LOCAL_DEBUG=1
export KEYBASE_DEV_TOOL_ROOTS="$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi"
```

If you're using bash on Linux:

```
export KEYBASE_LOCAL_DEBUG=1
export KEYBASE_DEV_TOOL_ROOTS=",$HOME/.config/google-chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

(See [this code](https://github.com/keybase/client/blob/master/shared/desktop/yarn-helper/electron.js#L47) for details.)

3. Run `yarn run start-hot`.

If you're running Chromium instead of Google Chrome, or if you've
installed the extension in your non-default browser, you'll have to
change the path passed to `KEYBASE_DEV_TOOL_ROOTS`.

If for some reason you don't want to use `start-hot`, you'll have to
set `KEYBASE_DEV_TOOL_EXTENSIONS` instead of `KEYBASE_DEV_TOOL_ROOTS`,
and you'll have to use the version subdirectory:

```
set -x KEYBASE_DEV_TOOL_EXTENSIONS "$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/2.5.2_0"
```

Note that this means you'll have to change the last path component if
Chrome updates the extension, which can happen at any time. (See [this
code](https://github.com/keybase/client/blob/7e9ad67c0f86a82649f2e81586986892adcdf6fa/shared/desktop/app/dev-tools.js)
and [the Electron
docs](https://electron.atom.io/docs/tutorial/devtools-extension/) for
details.)

Then you can run, e.g. `yarn start`.

## Other docs

see [Docs](docs)

## Misc

### Updating the list of countries with SMS support

In order to update the list of countries supported by Amazon SNS, run
the [update-data.sh](https://github.com/keybase/client/blob/master/shared/util/phone-numbers/sms-support/update-data.sh)
script. It will first fetch the JSON from Amazon's public S3 bucket and
transform it for use in our internal country filtering code.

### ESLint in VSCode

VSCode's ESLint extension needs to know where to look for .eslintrc. Add this to `REPO/.vscode/settings.json`.

```
{ "eslint.workingDirectories": ["shared"] }
```

### Watchman

You'll need to have watchman installed if you're running out of file descriptors:

```
brew install watchman
```
