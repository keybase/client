# Quick Start

1. `adb devices` (should list *exactly* one device) 
1. `adb reverse tcp:8081 tcp:8081` (port forward so react-native can reach its packager)
1. `yarn rn-gobuild-android`  (build the go library)
1. `yarn rn-start android` (start the packager)
1. `yarn rn-build-android` (builds the apk. or `gradle installDebug` inside android)
1. `yarn rn-push-android` (To install the apk on the device. NOTE: `gradle installDebug` does this automatically)

# Building the Go Library

```sh
# Build the go keybaselib
yarn rn-gobuild-android

# if this fails with something like "xcrun: error: unable to lookup item
# 'Path' in SDK 'iphoneos'" you might have a partial xcode install. try
xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

# Running in android studio

1. `adb devices` (should list *exactly* one device) 
1. `adb reverse tcp:8081 tcp:8081` (port forward so react-native can reach its packager)
1. `yarn rn-gobuild-android`  (build the go library)
1.  Inside android studio, Do "Build > Make Project" and then "Run > Run 'app'".

# Troubleshooting

## White Screen
Occasionally you might get a white screen that doesn't go away, even
after the bundler has finished bundling. Stopping the app and
restarting it seems to fix it.

## Can't reach packager (could not connect to development server)

can you see the packager in your computer's browser if you go to localhost:8081?

no -> You aren't runnning the packager, run `yarn rn-start android`

yes:
  can you see the packager in android's browser if you go to localhost:8081?

no -> You didn't port forward 8081 run `adb reverse tcp:8081 tcp:8081`

yes:
  Did you set debug server host & port to localhost:8081?

  no:

1. Dismiss redbox
1. Press volume up. A popup should appear (We're trying to get to the [react native debug menu](https://facebook.github.io/react-native/docs/debugging.html#accessing-the-in-app-developer-menu)
)
1. Click dev settings
1. Click Debug server host & port
1. set it to `localhost:8081` (See [#could-not-connect-to-development-server-error](running.md#could-not-connect-to-development-server-error) for more info)

  yes:
    You're in uncharted territories. Try using the java debugger in android studio and setting a break point in react-native's BundleDownloader and reading the actual error since it might be more informative than rn's generic handler. After you fix it, come back and update this page!

## Can't find variable: Promise

Same as below.


## React Native version mismatch


`yarn rn-build-clean-android`


## Hot reloading / File Watching

### Linux
[Here](../linux-dev.md#troubleshooting)

## Could not connect to development server error

On Android 28 and above HTTP traffic is disabled by default which can block
Metro Bundler from running properly. We have manually allowed `127.0.0.1` to
have HTTP traffic, so if you see an error about connecting to the bundler
server you should manually change the dev server URL and then kill and restart
the app:

```sh
# Enable loopback
adb reverse tcp:8081 tcp:8081
# Additionally, if running storybook
adb reverse tcp:7007 tcp:7007
```

Then open the [react native debug
menu](https://facebook.github.io/react-native/docs/debugging.html#accessing-the-in-app-developer-menu),
tap "Dev settings" and set "Debug server host & port for device" to
`127.0.0.1:8081`

## Also see general react-native troubleshooting
[Here](../react-native/troubleshooting.md)

