# Prereqs
Install xcode

# Quick Start

1. `yarn rn-gobuild-ios`  (build the go library)
1. `yarn rn-start ios` (start the packager)
1. `open ios/Keybase.xcworkspace` (Open workspace (not xcodeproj))
1. In xcode, select the target `Keybase` and run.


# Building the Go Library

```sh
# Build the go keybaselib
yarn rn-gobuild-ios

# if this fails with something like one of these:
#   * xcrun: error: unable to lookup item 'Path' in SDK 'iphoneos'
#   * gomobile: -target=ios requires XCode
# you might have a partial xcode install. try:
xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

# Running on a device

To run on a real phone, first you need to get Nojima or Marco to invite your Apple ID to the
Keybase team. Once you accept the invite, you should be able to
connect your phone to your computer and get XCode to build onto it.

However, you first have to edit
`ios/Keybase/AppDelegate.m` to use the bundler running on
your computer. Look for the comment "Uncomment for prod JS in dev
mode" and follow the instructions there.

Alternatively, you could choose "Profile" instead of "Run", which does
a prod build and thus doesn't need any bundler changes.


# Notifications

They don't work in the simulator at all. If you
choose "Run" and build on a phone, they _should_ just work. If you
want to do a "Profile" build, look in `local-debug.native.js` and move
`config.isDevApplePushToken = true` to outside its enclosing `if`
statement.

# Troubleshooting

## Error watching file for changes:

If you get this error in the React Packager:

```
React packager ready.

Loading dependency graph...2017-08-01 23:06 node[58084] (FSEvents.framework) FSEventStreamStart: register_with_server: ERROR: f2d_register_rpc() => (null) (-22)
2017-08-01 23:06 node[58084] (FSEvents.framework) FSEventStreamStart: register_with_server: ERROR: f2d_register_rpc() => (null) (-22)
2017-08-01 23:06 node[58084] (FSEvents.framework) FSEventStreamStart: register_with_server: ERROR: f2d_register_rpc() => (null) (-22)
 ERROR  Error watching file for changes: EMFILE
{"code":"EMFILE","errno":"EMFILE","syscall":"Error watching file for changes:","filename":null}
Error: Error watching file for changes: EMFILE
    at exports._errnoException (util.js:1024:11)
    at FSEvent.FSWatcher._handle.onchange (fs.js:1359:9)
Loading dependency graph...Process terminated. Press <enter> to close the window
```

the easiest way to fix it is simply to install watchman:

```
brew install watchman
```

## clang: error: no such file or directory: ... 

If you have Xcode 10 or later and see an error that `.../node_modules/react-native/third-party/double-conversion-1.1.6/src/strtod.cc` is missing, set Build System to `Legacy Build System` under file -> Workspace Settings.

## Also see general react-native troubleshooting
[Here](../react-native/troubleshooting.md)

