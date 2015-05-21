## Keybase for Mac OS X

### Installer

To build Keybase.app and dmg package, see the [Installer](https://github.com/keybase/client/tree/master/osx/Install/README.md). For updater info see the [Updater](https://github.com/keybase/client/tree/master/osx/Install/Updater/README.md).

### Xcode

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

## Keybase.app

### Environments

An environment consists of:

* **Home directory**: Where we keep state.
* **Server URL**: API endpoint (api.keybase.io)
* **Launchd label**: Identifier in launchd services (optional)
* **Other flags**: Debug, etc.

The default home directory for an environment is: `~/Library/Application Support/Keybase/{LaunchdLabel}`.

### Services

Keybase runs as a service by default. It is included in the app bundle ( `/Applications/Keybase.app/Contents/SharedSupport/bin/keybase`). When a user drags the app bundle to `/Applications` they are also installing (and upgrading) the Keybase service.

When the Keybase.app starts it will install these services.

For example:

```plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>keybase.Service.localhost</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Applications/Keybase.app/Contents/SharedSupport/bin/keybase</string>
    <string>-H</string>
    <string>/Users/gabe/Library/Application Support/Keybase/keybase.Service.localhost</string>
    <string>-s</string>
    <string>http://localhost:3000</string>
    <string>-d</string>
    <string>service</string>
  </array>
  <key>StandardErrorPath</key>
  <string>/Users/gabe/Library/Logs/Keybase/keybase.Service.localhost.err</string>
  <key>StandardOutPath</key>
  <string>/Users/gabe/Library/Logs/Keybase/keybase.Service.localhost.log</string>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

The launchd label is used as the identifier the default home directory and logging, so that if you are running multiple services, while in development, you won't have conflicts.

### Multiple Environments

Environments are setup so you can have multiple services set up and running at once, using different API servers and home directories. In development (or debug) mode, when the Keybase.app starts up it will ask which environment you want to connect to. A special "Custom" environment option is included if you are running the keybase services manually from source (not through launchd).

### Building Keybase.app

Build scripts for Keybase.app are located in the [osx/Install](osx/Install/README.md) directory.

### Helper Tool

In order to install the KBFS OSXFuse kernel extension, we may ask to install a Keybase helper tool. This uses the ServiceManagement framework and is the most appropriate way to do privilege escalation is OS X.

### Versioning

When Keybase.app starts up if checks the version of the currently running keybase daemons. It checks this against the version packaged in the Keybase.app Info.plist (KBServiceVersion). If there is a newer version than what is running it will ask launchd to restart it (launchctl unload/load). The same process occurs with the Helper tool (KBHelperVersion) and other services.

