# Keybase for Mac OS X

## Installer

To generate Keybase.app installer, see the [Installer](https://github.com/keybase/client/tree/master/osx/Install/README.md). For updater info see the [Updater](https://github.com/keybase/client/tree/master/osx/Install/Updater/README.md).

## Keybase.app

### Launch Services (keybased)

The keybased launch agent is installed on the first run of Keybase.app.

The launch agent configuration for keybased is located at:

`~/Library/LaunchAgents/keybase.keybased.plist`

The `keybased` binary is contained within Keybase.app at `/Applications/Keybase.app/Contents/MacOS/keybased`.

When Keybase.app is run it will force the launch agent to run keybased (even if it was explicitly unloaded). To unload keybased from launch agents, close Keybase.app (if running) and unload it:

`/bin/launchctl unload ~/Library/LaunchAgents/keybase.keybased.plist`

Alternatively to load keybased after it has been loaded:

`/bin/launchctl load -w ~/Library/LaunchAgents/keybase.keybased.plist`

To check the status of keybased in launch services:

`/bin/launchctl list | grep keybased`

Also `keybased` is run with the default configuration. When running keybased in development you should use an alternate home directory and socket/pid file location. For example,

`./keybased -H ~/Projects/keybase/home --socket-file=/tmp/keybase-dev.sock --pid-file=/tmp/keybase-dev.pid -s http://localhost:3000 -d local-rpc-debug svc`


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
