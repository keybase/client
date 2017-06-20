# Keybase Browser Extension

**Status**: Beta. Ready for public testing.

Currently focusing on a Chrome extension, but ultimately would like to support
other browsers too.


## Releasing a new version

There's a handy `Makefile` that will do most of the work (assuming you have
[jq](https://stedolan.github.io/jq/) installed):

```shell
$ make release
```

This will produce a file that looks like `keybase-chrome-1.2.3.zip` (except with
whatever the current version is set in the `manifest.json`).

Upload that file to the Chrome extension dashboard, hit publish, and we're done.


## Manual Install

### Chrome Extension

You can add the extension in development mode:

* Open Chrome to `chrome://extensions/`
* "Load unpacked extension..."
* Open this directory

Navigate to any Reddit thread and you should see "keybase chat reply" buttons.

### KBNM

This extension relies on `kbnm` (which lives in `../go/kbnm` of this repo). It
ships with recent versions of the Keybase app which will be used by default. You
can skip this step.

If you want to manually install the Keybase Native Messaging client (`kbnm`) and
install the whitelist for the extension to use the binary:

```shell
$ go get -u github.com/keybase/client/go/kbnm
$ $GOPATH/src/github.com/keybase/client/go/kbnm/install_host
Writing: /Users/shazow/Library/Application Support/Google/Chrome/NativeMessagingHosts/io.keybase.kbnm.json
Success: Installed Chrome NativeMessaging whitelist: /Users/shazow/local/go/bin/kbnm for io.keybase.kbnm
```

To uninstall, you can run:

```shell
$ $GOPATH/src/github.com/keybase/client/go/kbnm/install_host uninstall
```

Alternatively, recent versions of `kbnm` also comes with a built-in installer:

```shell
$ go get -u github.com/keybase/client/go/kbnm
$ $GOPATH/bin/kbnm install
…
$ $GOPATH/bin/kbnm uninstall
…
```


## License

This code shares the same license as the repository.
