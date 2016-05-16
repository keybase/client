## go-notifier

Cross platform system notifications in go (golang).

### Platforms

For OS X, we use NSUserNotificationCenter APIs from cgo. This only supports OS X 10.9 and above.

For Windows, we use [toaster](https://github.com/nels-o/toaster). This only supports Windows 8 and above.

For Linux, we use [notify-send](http://man.cx/notify-send).

### Install

```sh
go install github.com/keybase/go-notifier/notifier
```

### Alerts

If you need alert style (actionable) notifications (on OS X), you need to include an Info.plist
in the binary and sign it. You can look at `build_darwin.sh` on how to do this.

### Resources

Follows similar requirements of [node-notifier](https://github.com/mikaelbr/node-notifier),
but only supports recent platform versions.

Instead of [deckarep/gosx-notifier](https://github.com/deckarep/gosx-notifier), which uses an embedded version of [terminal-notifier](https://github.com/julienXX/terminal-notifier),
this implementation uses cgo to talk directly to NSUserNotificationCenter APIs. It is also possible to use AppleScript APIs to generate notifications (see [this post](https://apple.stackexchange.com/questions/57412/how-can-i-trigger-a-notification-center-notification-from-an-applescript-or-shel/115373#115373)),
but a cgo implementation was preferable.

The [0xAX/notificator](https://github.com/0xAX/notificator) only supports growlnotify on Windows and OS X.

The [vjeantet/alerter](https://github.com/vjeantet/alerter) app allows you to use alert style notifications on OS X.
