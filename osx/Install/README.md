## Installer

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * Xcode command line tools

### Build

#### Build keybased

You should make sure the go/libkb/version.go has the right version set.

```sh
sh build.sh
```

#### Update the app version (Info.plist)

```sh
sh version.sh 1.2.3
```

#### Build and export the Keybase.app

1. From Xcode, run Product | Clean and then Product | Archive.
1. From the Organizer (Window | Organizer), export the build you just created.
1. Select Export a Developer-ID signed application (requires you to be Team Agent).
1. Choose `osx/Install` as the directory to save Keybase.app.

#### Generate a Keybase.dmg

```sh
sh package.sh
```

#### Package the update

See the [Updater](https://github.com/keybase/client/tree/master/osx/Install/Updater/README.md).
