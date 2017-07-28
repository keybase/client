## Install

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * xcpretty (`gem install xcpretty`)
 * Xcode command line tools

### Build the Installer

You probably want to bump the version of the installer in both the "Bundle version" (CFBundleVersion)
and the "Bundle version string, short" (CFBundleShortVersionString) in [Installer/Info.plist](/osx/Installer/Info.plist).

```sh
./build_installer.sh
```

### Test the Installer

```sh
./build/KeybaseInstaller.app/Contents/MacOS/Keybase --app-path=/Applications/Keybase.app --run-mode=prod --timeout=10 --install-helper
```

### Releasing Installer

Upload the build KeybaseInstaller-x.y.z-darwin.tgz to the s3://prerelease.keybase.io/darwin-package folder.

Update the scripts that reference the older version such to include this version:
- [packaging/desktop/package_darwin.sh](packaging/desktop/package_darwin.sh)
- [packaging/desktop/kbfuse.sh](packaging/desktop/kbfuse.sh)

The installer is bundled into the Keybase.app, in `Keybase.app/Contents/Resources/KeybaseInstaller.app`.
