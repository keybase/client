# Keybase Browser Extension

**Status**: Beta. Ready for public testing.


## Releasing a new version

There's a handy `Makefile` that will do most of the work (assuming you have
[jq](https://stedolan.github.io/jq/download) installed):

```shell
$ make release
```

This will produce a file that looks like `keybase-chrome-1.2.3.zip` (except with
whatever the current version is set in the `manifest.json`).

Upload that file to the Chrome or Firefox extension dashboard, hit publish, and
we're done.


## Manual Install and QA

Build a fresh extension to load into your browsers:


```shell
$ yarn
$ make
```

### Chrome Install

You can add the extension in development mode:

* Open Chrome to `chrome://extensions/`
* Make sure "Developer mode" is checked
* "Load unpacked extension..."
* Open this directory


### Firefox Install

You can add the extension in development mode:

* Open Firefox to `about:debugging#addons`
* "Load Temporary Add-on"
* Open this directory
  the extension
* You can ignore the `Reading manifest: Error processing permissions...` error,
  FireFox does not support all the WebExtensions features yet.

### Quick QA Check

Once you have development versions of the extension in your browsers, run
through the following to quickly QA any changes you have made. Check that the
button appears and you can chat `joshblum` on:

* [keybase.io](https://keybase.io/joshblum)
* [reddit](https://www.reddit.com/user/joshblum)
* [HN](https://news.ycombinator.com/user?id=josh_blum)
* [GitHub](https://github.com/joshblum)
* [Twitter](https://twitter.com/blumua)
* [Facebook](https://www.facebook.com/ccoyne77)

Note: Reddit is doing a large redesign and this affects the extension. If you
are making any changes you should test against the old and new designs. You can
toggle which experience you get  by visiting https://www.reddit.com/prefs and
selecting "Use the redesign as my default experience".


### KBNM

This extension relies on `kbnm` (which lives in `../go/kbnm` of this repo). It
ships with recent versions of the Keybase app which will be used by default. You
can skip this step.

If you want to manually install the Keybase Native Messaging client (`kbnm`) and
install the whitelist for the extension to use the binary:

```shell
$ go get -u github.com/keybase/client/go/kbnm
$ $GOPATH/bin/kbnm install
```

To uninstall, you can run:

```shell
$ $GOPATH/bin/kbnm uninstall
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
