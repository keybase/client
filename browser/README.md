# Keybase Browser Extension

**Status**: Alpha. Functional but not ready for the public.

Currently focusing on a Chrome extension, but ultimately would like to support
other browsers too.


## Manual Install

You'll need to install the Keybase Native Messaging client (`kbnm`) and install the whitelist for the extension to use the binary:

```shell
$ go get github.com/keybase/client/go/kbnm
$ $GOPATH/src/github.com/keybase/client/go/kbnm/install_host
Writing: /Users/shazow/Library/Application Support/Google/Chrome/NativeMessagingHosts/io.keybase.kbnm.json
Success: Installed Chrome NativeMessaging whitelist: /Users/shazow/local/go/bin/kbnm for io.keybase.kbnm
```

Now you can add the extension in development mode:

* Open Chrome to `chrome://extensions/`
* "Load unpacked extension..."
* Open this directory

Navigate to any Reddit thread and you should see "keybase chat reply" buttons.

To uninstall, you can run:

```shell
$ $GOPATH/src/github.com/keybase/client/go/kbnm/install_host uninstall
```

Then remove the extension from your Chrome.
