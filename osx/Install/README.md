## Installer

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * xcpretty (`gem install xcpretty`)
 * Xcode command line tools

### Build

```sh
sh build.sh
```

### Updater package

See the [Updater](https://github.com/keybase/client/tree/master/osx/Install/Updater/README.md).

## Overview

When the Keybase.app runs it checks for the following components and compares the bundled version with the installed and running versions to make sure it's installed and up to date:

- Service (Launch Agent)
- Privileged Helper Tool
- KBFS (Launch Agent)
- OSXFuse (kext)

### Service

The bundled version info is read from the Keybase.app Info.plist (KBServiceVersion). The installed/running version is read from a file that the service writes on startup at: {CacheDir}/service.version. If this file is not found then we assume the service isn't running and we'll re-install it. (If the service is running (or starting up), we are careful to wait for this file to be generated (with a timeout).)

We read from a version file, because it's possible after an upgrade that the service running and the service installed will be different, and we need to tell launch services to restart it.

### Privileged Helper Tool 

The bundled version info is read from the Keybase.app Info.plist (KBHelperVersion). The installed/running version is checked by making a version (XPC) request. The install process relies on the ServiceManagement.framework (and OS) to install the privileged helper tool. See [Writing a Privileged Helper](https://developer.apple.com/library/mac/documentation/Security/Conceptual/SecureCodingGuide/Articles/AccessControl.html#//apple_ref/doc/uid/TP40002589-SW2) for more info.

### KBFS

The bundled version info is read from the Keybase.app Info.plist (KBFSVersion). The installed/running version is currently not available (there is an open issue for this). Since KBFS is a launch agent, like the Service, we should do everything the same as that.

We need to make sure when restarting KBFS after an upgrade that we do so safely.

### OSXFuse

The bundled version info is read from `Keybase.app/Contents/Resources/osxfusefs.bundle/Contents/Info.plist`.
The installed version info is read from `/Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext/Contents/Info.plist`.
The running version is queried from calling `KextManagerCopyLoadedKextInfo` from the privileged helper tool.

When upgrading we have to be careful to make sure KBFS is shutdown and there aren't any mounts.

