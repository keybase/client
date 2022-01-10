# Quick Start

1. `adb devices` (should list _exactly_ one device)
1. `yarn rn-gobuild-android`
1. `yarn react-native run-android`

## Prereqs

Follow instructions for "Building Projects with Native Code" at
https://facebook.github.io/react-native/docs/getting-started.html to
install and configure Android.

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

### macOS

If you're installing on macOS on High Sierra, skip installing
HAX. Instead, follow the instructions in
https://issuetracker.google.com/issues/62395878#comment7 , i.e. put
`HVF = on` in `~/.android/advancedFeatures.ini`.

On Mojave with the lastest android studio, this is no longer necessary.

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

## Android Studio

Select "Open an existing Android Studio Project" and point it to
`shared/android`. Not necessary to register the `client`
dir as a VCS-controlled dir with Android studio, but may as well.

You might get various prompts about installing various tools. You should
install 'Build Tools' and any missing platforms. However, _don't_
update the Android Gradle Plugin to 3.0.1.

Also see below for some messages you may encounter with Android Studio.

Some instructions talk about the SDK Manager / AVD Manager. This is
under the Tools > Android menu. You may have to wait for Gradle to
sync before they appear.

Before running the build process in android studio, you will need to
run `yarn rn-gobuild-android`.

### Dealing with Android Studio

Sometimes Android Studio gets into a bad state, especially if you're
doing stuff like `yarn modules` in the background.

If 'Gradle sync' fails, you can retry it from Tools > Android > 'Sync
Project with Gradle Files'.

Sometimes, especially after opening Android Studio after a run of
`yarn modules`, you'll get an "Unsupported Modules Detected" message
for "react-native-fetch-blob" and "react-native-contacts". This seems
to be harmless.

Sometimes you'll also get an "An IDE Error has occured" message. That
also seems to be harmless, although you may want to resync/reopen the
project in that case.

If nothing above works, you can try closing (File > Close Project) and
reopening the project. Or even closing and reopening the app.

### Building and developing without Android Studio

Alternatively, you can build and develop without Android
Studio. However, first make sure you _can_ build and run with Android
Studio first, as it's easier to get that working first.

So make sure you've run `yarn rn-gobuild-android` and you have the
react-native packager running (`yarn rn-start android`).

Then run

```sh
yarn react-native run-android # --variant 'debug'

# for storybook
yarn react-native run-android --variant 'storybook'

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
1. `yarn react-native run-android`

Happy developing!

### Troubleshooting

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

## `$HOME/.../Android/sdk/ndk-bundle` Does not point to an Android NDK

### macOS

If you're hitting this issue, it is because you either do not have an NDK installed or installed an NDK with an older version of Android Studio that created an old directory path.

Android Studio 3.5.0 and later seem to install ndk versions at the following path: `~/Library/Android/sdk/ndk/{version}`

To resolve this issue, use the `sdkmanager` to re-install `ndk-bundle` at the correct directory path.

[Instuctions can be found here](./setup.md)

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

## Also see general react-native troubleshooting

[Here](../react-native/troubleshooting.md)
