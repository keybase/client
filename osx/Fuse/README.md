## KBFuse

KBFuse is OSXFuse (or Fuse for MacOS) "branded" for Keybase. This is so we can maintain, install and upgrade fuse without
conflicting with existing OSXFuse installs. It also allows us to sign the kext with our certificate instead
of relying on 3rd party binaries shipped from other developers.

### Pre-requisites

#### Build from Xcode 7

In order to support 10.10 and above, you'll need to build from an older Xcode
version.

- Download Xcode 7 from /keybase/public/gabrielh/Xcode7.app.zip
- Place in /Applications (as Xcode7.app)
- `sudo xcode-select --switch /Applications/Xcode7.app`
- Move /Applications/Xcode.app out of the way: `mv /Applications/Xcode.app /tmp`

Afterwards, you should move Xcode.app back to /Applications.

You'll also need the Keybase signing certificate from someone at Keybase.

### Building KBFuse

    VERSION=3.6.3 ./build.sh

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
