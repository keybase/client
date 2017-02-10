## KBFuse

KBFuse is OSXFuse (or Fuse for MacOS) "branded" for Keybase. This is so we can maintain, install and upgrade fuse without
conflicting with existing OSXFuse installs. It also allows us to sign the kext with our certificate instead
of relying on 3rd party binaries shipped from other developers.

### Pre-requisites

#### Build from Xcode 7

- Move any existing /Applications/Xcode.app somewhere else (out of /Applications), otherwise the build scripts will use it instead
- Download Xcode 7 from the private Keybase group folder on KBFS (macos/Xcode7.app.zip)
- Place in /Applications and rename to Xcode.app

You'll also need the Keybase signing certificate from someone at Keybase.

### Building KBFuse

    VERSION=3.5.5 ./build.sh

This should generate a kbfuse.bundle (and fsbundle.tgz, that includes debug symbols)
which you can submit for PR.

This bundle is included in the KeybaseInstaller.app, so you'll need to build a new
installer, see [Building the Installer](/osx/Scripts/README.md).

Be sure to switch back to latest Xcode after you build.

### Manual Install

If you are upgrading you should uninstall the kext first (see below).

To install:

    ./install.sh

### Manual Uninstall

Don't try to kextunload unless you have everything unmounted.

    // Check for any mounts (if there are you need to umount)
    mount -t kbfuse

    sudo kextunload -b com.github.kbfuse.filesystems.kbfuse
    sudo rm -rf /Library/Filesystems/kbfuse.fs

### Verifying

After install if you are having problems loading the kext:

    sudo kextutil -l /Library/Filesystems/kbfuse.fs/Contents/Extensions/10.10/kbfuse.kext

View kext status:

    sudo kextstat -b com.github.kbfuse.filesystems.kbfuse
