# Quick Start

1. `brew install watchman` (install file watcher)
1. `adb devices` (should list _exactly_ one device)
1. `yarn rn-gobuild-android`
1. `yarn android-debug`

## Prereqs

Follow instructions for running an android project at https://reactnative.dev/

### Installing an NDK version

Additionally an `NDK` version needs to be installed for `yarn rn-gobuild-android` to work.

**With Android Studio**
You will already have the `sdkmanager` command line tool installed. So run:

`sdkmanager --install "ndk-bundle"` which should write to `$HOME/Library/Android/sdk/ndk-bundle` on macOS.

**Without Android Studio**
You will need the Android Studio Command Line Tools to use `sdkmanager` without Android Studio.
[Download Command Line Tools](https://developer.android.com/studio/index.html#command-tools) here.

Then run `sdkmanager --install "ndk-bundle"` which should write to `$HOME/Library/Android/sdk/ndk-bundle` on macOS.

## Emulator Setup

### Linux

If you're installing on Linux, you'll want to get KVM set
up. Otherwise, you'll see this message:

```
> ./emulator @Nexus_5X_API_28_x86
emulator: ERROR: x86 emulation currently requires hardware acceleration!
Please ensure KVM is properly installed and usable.
CPU acceleration status: This user doesn't have permissions to use KVM (/dev/kvm)
```

Normally, `/dev/kvm` can only be used by `root`, but you don't
want to run things as root regularly. Instead, make a `kvm` group and
add your current user in it:

```sh
# As root
addgroup kvm
usermod -a -G kvm $USER
```

You may have to log out and re-log in, or even reboot, for this to
take effect. Then you'll want to configure the right group and permissions
for `/dev/kvm`. From [this StackExchange answer](https://unix.stackexchange.com/questions/373872/non-root-user-can-not-use-enable-kvm),

1. Create the file `/etc/udev/rules.d/65-kvm.rules` as root
2. Put the following line inside this file:

```
KERNEL=="kvm", NAME="%k", GROUP="kvm", MODE="0660"
```

3. Reload rules with `udevadm control --reload-rules && udevadm trigger`

## Running

```sh
yarn android-debug
```

Unless you're modifying the Java files or you're modifying Go files
(and thus re-running `run-gobuild-android`), you likely have to only
run this occasionally.

Then make sure you either have an emulator running, or you have your
Android device connected (but not both). To check, run

```sh
adb devices
```

It should list exactly one device.

### Using an emulator

Either use the avd manager in Android Studio or use the raw commands below.
Setting up an avd is much easier in Android Studio, so it's recommended to do that for the inital setup at least

```sh
# Even though emulator should be in your path, it
# seems to require you to be in this directory.
cd $ANDROID_HOME/emulator

emulator -list-avds

# Nexus_5X_API_27_x86 is an example avd.
#
# The leading './' is needed on Linux.
./emulator @Nexus_5X_API_27_x86
```

assuming you've set the `$ANDROID_HOME` variable and added
`$ANDROID_HOME/tools` to your `PATH`, per
https://facebook.github.io/react-native/docs/getting-started.html .

### Using a device

To run on your Android device, make sure USB debugging is enabled; see
[these
instructions](https://facebook.github.io/react-native/docs/running-on-device.html). Then
plug in your device via USB and tap 'OK' on the 'Allow USB debugging?'
prompt if it appears. After that, `adb devices` should list your
device. If it says 'unauthorized' next to your device, then you likely
haven't tapped 'OK' on the prompt yet. If you saw no prompt, try
revoking (https://stackoverflow.com/a/25546300/670659).

**Turn off Instant Run**

To turn off Instant Run go to [Android Studio | Settings | Build, Execution, Deployment | Instant Run | Uncheck the box](https://i.imgur.com/0ofeBMn.png).

If you see the errors including `Failed to execute aapt` or `transformDexWithInstantRunDependenciesApkForDebug` the problem might be that Instant Run is enabled.

## Port forwarding

You need to port forward 8081 so react-native can react its packager.

On your computer run:

```sh
adb reverse tcp:8081 tcp:8081
```

To recap, you should have run:

1. `adb devices` (should list _exactly_ one device)
1. `yarn rn-gobuild-android`
1. `yarn android-debug`

Happy developing!

### Troubleshooting

## Can't reach packager (could not connect to development server)

can you see the packager in your computer's browser if you go to localhost:8081?

no -> You aren't runnning the packager, run `yarn rn-start2`

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
1. set it to `localhost:8081` (See [#could-not-connect-to-development-server-error] for more info)

yes:
You're in uncharted territories. Try using the java debugger in android studio and setting a break point in react-native's BundleDownloader and reading the actual error since it might be more informative than rn's generic handler. After you fix it, come back and update this page!

## React Native version mismatch

`yarn rn-build-clean-android`

## `$HOME/.../Android/sdk/ndk-bundle` Does not point to an Android NDK

### macOS

If you're hitting this issue, it is because you either do not have an NDK installed or installed an NDK with an older version of Android Studio that created an old directory path.

Android Studio 3.5.0 and later seem to install ndk versions at the following path: `~/Library/Android/sdk/ndk/{version}`

To resolve this issue, use the `sdkmanager` to re-install `ndk-bundle` at the correct directory path.

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

## Remote Debugging with React Dev Tools

1. Open the [react native debug menu](https://facebook.github.io/react-native/docs/debugging.html#accessing-the-in-app-developer-menu) and select **Enabled Remote Debugging**
2. Next, in the react native debug menu, select **Dev Settings** and set **Debug server host & port for device** to `127.0.0.1:8081`
3. Open launch the standalone [react-devtools](https://facebook.github.io/react-native/docs/debugging.html#react-developer-tools) electron application
4. Loopback which ever port `react-devtools` is running on:

```sh
# React devtools standalone port
adb reverse tcp:8097 tcp:8097
```
