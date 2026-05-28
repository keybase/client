# Prereqs

Install xcode

```
brew install watchman cocoapods #install the file watcher
```

# Quick Start

```
yarn modules && yarn ios:pod:install
yarn ios:gobuild # build the go library
open ios/Keybase.xcworkspace # Open workspace, not xcodeproj
yarn rn:start # start the packager
```

In xcode, select the target `Keybase` and run.

# Building the Go Library

```sh
# Build the go keybaselib
yarn ios:gobuild

# if this fails with something like one of these:
#   * xcrun: error: unable to lookup item 'Path' in SDK 'iphoneos'
#   * gomobile: -target=ios requires XCode
# you might have a partial xcode install. try:
xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

# Notifications

They don't work in the simulator at all. If you
choose "Run" and build on a phone, they _should_ just work. If you
want to do a "Profile" build, look in `local-debug.native.js` and move
`config.isDevApplePushToken = true` to outside its enclosing `if`
statement.
