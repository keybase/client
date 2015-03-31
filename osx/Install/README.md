## Installer

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * Xcode command line tools

### Build

#### Tag the repo

git tag -a x.y.z -m x.y.z

#### Update the Info.plist version

```sh
sh version.sh
```

#### Build and export the Keybase.app

1. From Xcode, run Product | Clean and then Product | Archive.
1. From the Organizer (Window | Organizer), export the build you just created.
1. Select Export a Developer-ID signed application (requires you to be Team Agent).
1. Choose `osx/Install` as the directory to save Keybase.app.

#### Build keybased

```sh
sh build.sh
```

#### Generate a Keybase.dmg

```sh
sh package.sh
```

#### Push tags

If the build works ok, push the tag `git push --tags`

#### Package the update

See the [Updater](https://github.com/keybase/client/tree/master/osx/Install/Updater/README.md).
