## KBFuse

KBFuse is OSXFuse "branded" for Keybase. This is so we can maintain, install and upgrade fuse without
conflicting with existing OSXFuse installs. It also allows us to sign the kext with our certificate instead
of relying on 3rd party binaries from other developers.

### Switch to (older) Xcode 7

- Move any existing /Applications/Xcode.app somewhere else (out of /Applications).
Otherwise the build scripts will use it instead.
- Download Xcode 7 from the private Keybase group folder on KBFS (Xcode7.app.zip).
- Place in /Applications and rename to Xcode.app.

### Building KBFuse from OSXFuse

    VERSION=3.5.5 ./build.sh

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

### Differences from Fuse for macOS (osxfuse)

KBFuse is the same as Fuse for macOS (or osxfuse) except certain identifiers
like the kext id are renamed so as not to conflict if a user has osxfuse
installed. This allows us to use specific recent versions that are tested with
kbfs without breaking other apps that rely on certain older versions of osxfuse.
