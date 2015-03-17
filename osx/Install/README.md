# Installer

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * Xcode command line tools

### Build

Update the version in Info.plist:

```sh
sh version.sh
```

#### Build and export the Keybase.app:

1. From Xcode, run Product | Archive.
1. From the Organizer (Window | Organizer), export the build you just created.
1. Select Export a Developer-ID signed application (requires you to be Team Agent).
1. Choose `osx/Install` as the directory to save Keybase.app.

#### Build keybased

```
sh build_keybase.sh
```

#### Generate a Keybase.dmg

```
sh package.sh
```
