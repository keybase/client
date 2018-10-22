
**Attention, please.**

This code is a work in progress, and we publish it for full transparency. You can review the source code, but:

 - you shouldn't just run this code without reading it, as it may have bugs or stubbed out crypto
 - it might not do exactly what it says it is doing

If you really want to install Keybase, please return to the [top level Readme.md](https://github.com/keybase/client/blob/master/README.md) for official release instructions.

----------

## Keybase for macOS

**2nd Warning**: The code in this repository does not represent a finalized
architecture or API and we will probably not accept any external pull requests.
*We advise you not to fork this repository.*

### Project Setup

```sh
# Install CocoaPods (if not installed)
sudo gem install cocoapods
pod setup

# Generate workspace
pod install

# Open workspace (not xcodeproj)
open Keybase.xcworkspace
```

Then select the target ```Keybase``` and run.

## Building

To build the installer, view instructions at [Scripts/README.md](Scripts/README.md).

## macOS Installer Overview

```
┌────────────────────────────────┐
│desktop/app/installer.desktop.js│
└────────────────────────────────┘
             │
             │
             ▼
┌────────────────────────────────┐
│keybase install-auto            │
│keybase install --components=...│
└────────────────────────────────┘
             │
             │
             ▼
  ┌────────────────────┐
  │ go/install package │
  └────────────────────┘
             │
             ▼
 ┌──────────────────────┐
 │ non-privileged tasks │
 └──────────────────────┘
 ┌──────────────────────┐
 │   privileged tasks   │
 └──────────────────────┘
             │
             │
             ▼
  ┌─────────────────────┐
  │KeybaseInstaller.app │
  └─────────────────────┘
```

### Go Install Package

Install tasks are managed by the `go/install` package. You can interact with this package via the command line client, for example,
by specifying components to install.

Install the service (in launchd):
```
keybase install --components=service
```

Install the helper tool, Fuse and the mount directory, and start KBFS service:
```
keybase install --components=helper,fuse,mountdir,kbfs
```

If the installed component requires a privileged task or native code (like Fuse), the go package will call into
the native KeybaseInstaller.app (see below).

### keybase install-auto

When the Electron app starts up it runs `keybase install-auto` in [shared/desktop/app/installer.desktop.js](https://github.com/keybase/client/blob/master/shared/desktop/app/installer.desktop.js).

By default this runs install with the components:
- `cli`: Command line (to /usr/local/bin)
- `updater`: Updater in launchd
- `service`: Service in launchd
- `kbfs`: KBFS in launchd (without mount), needed by chat
- `kbnm`: Browser native messaging

If Fuse has been installed (via the Folder tab), it will also install/update the following components:
- `helper`: Helper tool which runs privileged tasks
- `fuse`: Fuse kext
- `mountdir`: Creates /keybase
- `kbfs`: KBFS in launchd (with mount)

### KeybaseInstaller.app

The KeybaseInstaller.app has options to install native components (via privileged tasks in the Helper tool) via the command line parameters:

For example, to install (or update) Fuse, you can run:

```sh
/Applications/Keybase.app/Contents/Resources/KeybaseInstaller.app/Contents/MacOS/Keybase \
  --app-path=/Applications/Keybase.app --run-mode=prod --timeout=60 --install-fuse
```

Other arguments include:

- `install-fuse`: Installs KBFuse, our custom osxfuse build, see [Fuse/kbfuse](osx/Fuse/kbfuse) for more details.
- `install-mountdir`: Creates the `/keybase` folder.
- `install-helper`: Installs helper tool, which runs privileged tasks. See [Privileged Helper Tool](https://developer.apple.com/library/mac/documentation/Security/Conceptual/SecureCodingGuide/Articles/AccessControl.html#//apple_ref/doc/uid/TP40002589-SW2).
- `install-cli`: Installs command line into `/usr/local/bin` or `/etc/paths.d/Keybase`
- `install-app-bundle`: Installs app by verifying app bundle and then moving it into `/Applications/Keybase.app` (as privileged task).

It also has corresponding uninstall options:

- `uninstall-fuse`
- `uninstall-mountdir`
- `uninstall-helper`
- `uninstall-cli`
- `uninstall-app`

### Styleguide

See [STYLEGUIDE.md](STYLEGUIDE.md).

### Dev References

[Launch Agents, Services, XPC](https://developer.apple.com/library/mac/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html): Describes how services are installed and run.

[App Extensions](https://developer.apple.com/library/mac/documentation/General/Conceptual/ExtensibilityPG/ExtensionCreation.html): Describes app extensions for Actions, Share and Finder Sync.

[Privileged Helper Tool](https://developer.apple.com/library/mac/documentation/Security/Conceptual/SecureCodingGuide/Articles/AccessControl.html#//apple_ref/doc/uid/TP40002589-SW2): Describes the Helper tool functionality.


### Xcode Settings

In Xcode, Preferences, Text Editing:

* Prefer indent using: Spaces
* Tab width: 2 spaces
* Indent width: 2 spaces
