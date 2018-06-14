
**Attention, please.**

This code is a work in progress, and we publish it for full transparency. You can review the source code, but:

 - you shouldn't just run this code without reading it, as it may have bugs or stubbed out crypto
 - it might not do exactly what it says it is doing

If you really want to install Keybase, please return to the [top level Readme.md](https://github.com/keybase/client/blob/master/README.md) for official release instructions.

----------

## Keybase

### Project Status

Hi everyone! This folder's code is *not* ready for prime time. Use at your own risk (and never against production!)
We are iterating quickly and a lot of the code is changing every day.

### Install

```sh
yarn install
```

### Desktop

The following `yarn run` commands, to build, run or package the app:

| Command | Description |
|---------|-------------|
| start | Build a development bundle and start app |
| hot-server | Start the hot-reloading server |
| start-hot | Connect to a hot-reloading server (If you're developing and want to see changes as you make them) |
| build-dev | Build development bundle |
| build-prod | Build prod bundle |
| package | Package app |


You can set environment variables for debugging:

| Env     | Description |
|---------|-------------|
| KEYBASE_RUN_MODE | Run mode: prod, staging, devel |
| KEYBASE_LOCAL_DEBUG | For debugging |
| KEYBASE_FEATURES | Feature flags |
| KEYBASE_RPC_DELAY | Number of ms to delay all RPC calls (requires debug mode) |
| KEYBASE_RPC_DELAY_RESULT | Number of ms to delay all RPC call callbacks (requires debug mode) |
| NO_DASHBOARD | Don't show dashboard |

### iOS

```sh
# Build the go keybase.framework
yarn run rn-gobuild-ios

# if this fails with something like 'xcrun: error: unable to lookup item 'Path' in SDK 'iphoneos' you might have a partial xcode install. try
xcode-select --switch /Applications/Xcode.app/Contents/Developer

# Open workspace (not xcodeproj)
open react-native/ios/Keybase.xcworkspace
```

Then select the target `Keybase` and run.

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

The above suffices for running in the simulator. To run on a real
phone, first you need to get Marco to invite your Apple ID to the
Keybase team. Once you accept the invite, you should be able to
connect your phone to your computer and get XCode to build onto it.

However, you first have to edit
`react-native/ios/Keybase/AppDelegate.m` to use the bundler running on
your computer. Look for the comment "Uncomment for prod JS in dev
mode" and follow the instructions there.

Alternatively, you could choose "Profile" instead of "Run", which does
a prod build and thus doesn't need any bundler changes.

As for notifications, they don't work in the simulator at all. If you
choose "Run" and build on a phone, they _should_ just work. If you
want to do a "Profile" build, look in `local-debug.native.js` and move
`config.isDevApplePushToken = true` to outside its enclosing `if`
statement.

### Android

Follow instructions at
https://facebook.github.io/react-native/docs/getting-started.html to
install and configure Android.

If you're installing on macOS on High Sierra, skip installing
HAX. Instead, follow the instructions in
https://issuetracker.google.com/issues/62395878#comment7 , i.e. put
`HVF = on` in `~/.android/advancedFeatures.ini`.

Follow instructions at
https://developer.android.com/ndk/guides/index.html to install and
configure the Android NDK.

Don't install Revision 16, though. Instead, go to
https://developer.android.com/ndk/downloads/older_releases.html and
download Revision 15c. Then unzip it, and do:

```sh
mv $ANDROID_HOME/ndk-bundle{,.r16} # if needed
mv /path/to/android-ndk-r15c/ $ANDROID_HOME/ndk-bundle
```

Then select "Open an existing Android Studio Project" and point it to
`shared/react-native/android`. Not necessary to register the `client`
dir as a VCS-controlled dir with Android studio, but may as well.

You'll get various prompts about installing various tools. You should
install 'Build Tools' and any missing platforms. However, _don't_
update the Android Gradle Plugin to 3.0.1.

Also see below for some messages you may encounter with Android Studio.

Some instructions talk about the SDK Manager / AVD Manager. This is
under the Tools > Android menu. You may have to wait for Gradle to
sync before they appear.

To run on the Android simulator:

```sh
# Build the go keybaselib
yarn run rn-gobuild-android

# Start the react native publisher (unlike on iOS, have to do this manually).
yarn run rn-start
```

Then do "Build > Make Project" and then "Run > Run 'app'".

#### Dealing with Android Studio

Sometimes Android Studio gets into a bad state, especially if you're
doing stuff like `yarn modules` in the background.

If 'Gradle sync' fails, you can retry it from Tools > Android > 'Sync
Project with Gradle Files'.

Sometimes, especially after opening Android Studio after a run of
`yarn modules`, you'll get an "Unsupported Modules Detected" message
for "react-native-fetch-blob", "react-native-contacts", and
"react-native-image-picker". This seems to be harmless.

Sometimes you'll also get an "An IDE Error has occured" message. That
also seems to be harmless, although you may want to resync/reopen the
project in that case.

If nothing above works, you can try closing (File > Close Project) and
reopening the project. Or even closing and reopening the app.

#### Building and developing without Android Studio

Alternatively, you can build and develop without Android
Studio. However, first make sure you _can_ build and run with Android
Studio first, as it's easier to get that working first.

So make sure you've run `yarn rn-gobuild-android` and you have the
react-native packager running (`yarn rn-start`).

Then run

```sh
# Build the apk.
yarn run rn-build-android
```

Unless you're modifying the Java files, you likely have to only run
this occasionally.

Then make sure you either have an emulator running, or you have your
Android device connected (but not both). To check, run

```sh
adb devices
```

It should list exactly one device.

To run the emulator, do:

```sh
cd $ANDROID_HOME/emulator
emulator -list-avds
# Nexus_5X_API_27_x86 is an example avd.
emulator @Nexus_5X_API_27_x86
```

To run on your Android device, make sure USB debugging is enabled; see
[these
instructions](https://facebook.github.io/react-native/docs/running-on-device.html). Then
plug in your device via USB and tap 'OK' on the 'Allow USB debugging?'
prompt if it appears. After that, `adb devices` should list your
device. If it says 'unauthorized' next to your device, then you likely
haven't tapped 'OK' on the prompt yet.

Finally, you'll have to forward port 8081 on your device to port 8081
on your computer. To do so, run

```sh
adb reverse tcp:8081 tcp:8081
```

To recap, you should have run `rn-gobuild-android`,
`rn-build-android`, have the react-native packager running, and either
have an emulator running, or an Android device connected. `adb
devices` should list exactly one connected device.

Then you can run

```sh
yarn rn-push-android
```

to push the debug APK to your emulator or device, and it should
connect to the react-native packager instance on your machine. Happy
developing!

Occasionally you might get a white screen that doesn't go away, even
after the bundler has finished bundling. Stopping the app and
restarting it seems to fix it.

### Debugging with React Developer Tools and Immutable.js Object Formatter extensions

1) Install the [React Developer
Tools](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
and the [Immutable.js Object
Formatter](https://chrome.google.com/webstore/detail/immutablejs-object-format/hgldghadipiblonfkkicmgcbbijnpeog)
extensions in your regular Chrome browser.
2) Set the following environment variables and make sure
`KEYBASE_PERF` is unset. If you're using fish shell on macOS:

```
set -e KEYBASE_PERF
set -x KEYBASE_LOCAL_DEBUG 1
set -x KEYBASE_DEV_TOOL_ROOTS "$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi,$HOME/Library/Application Support/Google/Chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

If you're using fish shell on Linux:

```
set -e KEYBASE_PERF
set -x KEYBASE_LOCAL_DEBUG 1
set -x KEYBASE_DEV_TOOL_ROOTS "$HOME/.config/google-chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi,$HOME/.config/google-chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

If you're using bash on macOS:

```
unset KEYBASE_PERF
export KEYBASE_LOCAL_DEBUG=1
export KEYBASE_DEV_TOOL_ROOTS="$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi,$HOME/Library/Application Support/Google/Chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

If you're using bash on Linux:

```
unset KEYBASE_PERF
export KEYBASE_LOCAL_DEBUG=1
export KEYBASE_DEV_TOOL_ROOTS="$HOME/.config/google-chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi,$HOME/.config/google-chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog"
```

(See [this code](https://github.com/keybase/client/blob/master/shared/desktop/yarn-helper/electron.js#L47) for details.)

3) Run `yarn run start-hot`.

If you're running Chromium instead of Google Chrome, or if you've
installed the extension in your non-default browser, you'll have to
change the path passed to `KEYBASE_DEV_TOOL_ROOTS`.

If for some reason you don't want to use `start-hot`, you'll have to
set `KEYBASE_DEV_TOOL_EXTENSIONS` instead of `KEYBASE_DEV_TOOL_ROOTS`,
and you'll have to use the version subdirectory:

```
set -x KEYBASE_DEV_TOOL_EXTENSIONS "$HOME/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/2.5.2_0,$HOME/Library/Application Support/Google/Chrome/Default/Extensions/hgldghadipiblonfkkicmgcbbijnpeog/1.7_0"
```

Note that this means you'll have to change the last path component if
Chrome updates the extension, which can happen at any time. (See [this
code](https://github.com/keybase/client/blob/7e9ad67c0f86a82649f2e81586986892adcdf6fa/shared/desktop/app/dev-tools.js)
and [the Electron
docs](https://electron.atom.io/docs/tutorial/devtools-extension/) for
details.)

Then you can run, e.g. `yarn run start`.

4) Make sure to check 'Enable custom formatters' in the DevTools settings for Immutable.js Object Formatter.

### Troubleshooting

If you run into weird issues with your packager this may be due to a stale cache, run this command to wipe your local cache:

```sh
yarn run rn-packager-wipe-cache
```

If it seems like hot reloading or anything that depends on
file-watching isn't working on Linux, you're probably running into
`inotify` limits. As a quick check, try doing

```sh
tail -f (some file)
```

If you get

```
tail: inotify cannot be used, reverting to polling: Too many open files
```

then that's a telltale sign of running out of `inotify` watches. For more details, do (in bash)

```sh
echo "pid    watches cmd"; for x in $(find /proc/*/fd/* -type l -lname 'anon_inode:inotify' 2>/dev/null); do PID=$(echo $x | cut -f 3 -d'/'); FD=$(echo $x | cut -f 5 -d'/'); WATCHCOUNT=$(grep -c inotify /proc/$PID/fdinfo/$FD); CMD=$(cat /proc/$PID/cmdline | sed 's/\x0/ /g'); echo "$PID       $WATCHCOUNT     $CMD"; done | sort -k 2 -n -r
```

which prints a list of commands with inotify watches sorted by number
of watches in decreasing order. On my system, flow and storybook use
up about 11000 watches. (See [this StackExchange
answer](https://unix.stackexchange.com/a/426001) for an explanation
for the above one-liner; however, its command is slower due to using
`lsof`.)

See [this
link](https://github.com/guard/listen/wiki/Increasing-the-amount-of-inotify-watchers)
for how to increase the watch limit; I set mine to 65536.

#### Native inspector

If you get this error message on trying to open the inspector:

`Expected to find exactly one React Native renderer on DevTools hook.`

It might be because you're importing a library that attaches itself as a renderer, such as `react-dom`. If that's the case, you should make sure not to import any such module outside of a `.desktop.js` file, and if you have to, it should be predicated on `!isMobile` and use `require` to access the library.

### Dependency forks

We have some custom forks of dependencies. This is usually a temporary fix and is something we want to avoid long term.

- react-navigation:
  - Keep queued transitions, fixes races with dragging and touches
  - Increase interactivity threshold so you can click while things are still animating
- electron-download
  - Add a force-use-cache option so we don't download all the time
- react-native-push-notification
  - 1 liner to add RN 0.47 support


### Updating `react-native`

Take a look at [this repo](https://github.com/ncuillery/rn-diff), which contains branches for every version of react native. For example, this URL

 `https://github.com/ncuillery/rn-diff/compare/rn-0.51.0...rn-0.53.0` 
 
 generates the diff between RN versions in a bare RN app. Use this to figure out if any configuration changes are needed. If the target version isn't in `rn-diff` yet, there'll usually be a fork that has it.
