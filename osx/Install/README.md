
## Launch Services

### keybased

The launch agent configuration for keybased is located at:

`~/Library/LaunchAgents/keybase.keybased.plist`

This file is installed on the first run of Keybase.app.

The `keybased` binary is contained within Keybase.app at `/Applications/Keybase.app/Contents/MacOS/keybased`.

When Keybase.app is run it will force the launch agent to run keybased (even if it was explicitly unloaded). To unload keybased from launch agents, close Keybase.app (if running) and unload it:

`/bin/launchctl unload ~/Library/LaunchAgents/keybase.keybased.plist`

Alternatively to load keybased after it has been loaded:

`/bin/launchctl load -w ~/Library/LaunchAgents/keybase.keybased.plist`

To check the status of keybased in launch services:

`/bin/launchctl list | grep keybased`

Also `keybased` is run with the default configuration. When running keybased in development you should use an alternate home directory and socket/pid file location. For example,

`./keybased -H ~/Projects/keybase/home --socket-file=/tmp/keybase-dev.sock --pid-file=/tmp/keybase-dev.pid -s http://localhost:3000 -d local-rpc-debug svc`


## Installer

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * Xcode command line tools

### Build

#### Update the Info.plist version

```sh
sh version.sh
```

#### Build and export the Keybase.app

1. From Xcode, run Product | Archive.
1. From the Organizer (Window | Organizer), export the build you just created.
1. Select Export a Developer-ID signed application (requires you to be Team Agent).
1. Choose `osx/Install` as the directory to save `Keybase.app`.

#### Build keybased

```sh
sh build.sh
```

#### Generate a Keybase.dmg

```sh
sh package.sh
```
