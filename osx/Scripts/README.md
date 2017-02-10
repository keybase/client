## Install

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * xcpretty (`gem install xcpretty`)
 * Xcode command line tools

### Building the Installer

You probably want to bump the version of the installer in both the "Bundle version" (CFBundleVersion)
and the "Bundle version string, short" (CFBundleShortVersionString) in [Installer/Info.plist](/osx/Installer/Info.plist).

```sh
./build_installer.sh
```

### Test Installer

```sh
./build/KeybaseInstaller.app/Contents/MacOS/Keybase --app-path=/Applications/Keybase.app --run-mode=prod --timeout=10
```

### Releasing Installer

Upload the build KeybaseInstaller-x.y.z-darwin.tgz to the latest release downloads at https://github.com/keybase/client/releases.

Update the scripts that reference the older version such to include this version:
- `packaging/desktop/package_darwin.sh`
- `packaging/desktop/kbfuse.sh`

## Overview

When the Keybase.app runs it checks for the following components and compares the bundled version with the installed and running versions to make sure it's installed and up to date:

- Service (Launch Agent)
- Privileged Helper Tool
- KBFS (Launch Agent)
- KBFuse (our custom osxfuse build, see [Fuse/kbfuse](https://github.com/keybase/client/tree/master/osx/Install/Fuse/kbfuse) for more details).
