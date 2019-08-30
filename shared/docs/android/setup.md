## Prereqs

Follow instructions for "Building Projects with Native Code" at
https://facebook.github.io/react-native/docs/getting-started.html to
install and configure Android.

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
# Build the apk.
yarn rn-build-android

# Or with gradle (inside android)
# You can also use the gradle wrapper `./gradlew` in android
gradle installDebug


# for storybook
gradle installStorybook

# gradle tasks shows all the things you can do with gradle
gradle tasks
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
1. `yarn rn-gobuild-android`,
1. `yarn rn-start android`
1. `yarn rn-build-android` (or `gradle installDebug` inside android),
1. `yarn rn-push-android` (To install the apk on the device. NOTE: `gradle installDebug` does this automatically)

and have an emulator or android device connected. (i.e. `adb devices` should list _exactly_ one device)

Then you can run

```sh
yarn rn-push-android
```

to push the debug APK to your emulator or device, and it should
connect to the react-native packager instance on your machine. Happy
developing!

### Troubleshooting

Occasionally you might get a white screen that doesn't go away, even
after the bundler has finished bundling. Stopping the app and
restarting it seems to fix it.
