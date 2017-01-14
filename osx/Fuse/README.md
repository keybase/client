## KBFuse

KBFuse is OSXFuse "branded" for Keybase. This is so we can maintain, install and upgrade fuse without
conflicting with existing OSXFuse installs. It also allows us to sign the kext with our certificate instead
of relying on 3rd party binaries from other developers.

### Switch to (older) Xcode 7

You'll need to build using Xcode 7 (which includes the 10.10 SDK), and move any other Xcode
out of the way (out of /Applications), otherwise the osxfuse scripts will try to compile
using a newer SDK instead.

### Building KBFuse from OSXFuse

    VERSION=3.5.4 ./build.sh

### Manual Install

If you are upgrading you should uninstall the kext first (see below).

To install:

    ./install.sh

### Uninstall

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

### Release

The Fuse bundle is included in the KeybaseInstaller.app.
Building a new installer will automatically pick up the kbfuse.bundle checked in here.

### Differences from Fuse for macOS

KBFuse is the same as Fuse for macOS (or osxfuse), except for the default admin group,
which we change from "admin" to "staff". This allows us to specify allow_root and still
work properly for users that aren't administrators.
