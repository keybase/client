## Installer

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * xcpretty (`gem install xcpretty`)
 * Xcode command line tools

### Build

```sh
sh build.sh x.y.z   # Version
```

### Package

Creates dmg and copies the app into /Applications.

```sh
sh package.sh
```

### Updater package

See the [Updater](https://github.com/keybase/client/tree/master/osx/Install/Updater/README.md).
