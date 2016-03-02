## KBFuse

KBFuse is OSXFuse "branded" for Keybase. This is so we can maintain, install and upgrade fuse without
conflicting with existing OSXFuse installs. It also allows us to sign the kext with our certificate instead
of relying on 3rd party binaries from other developers.

### Building KBFuse from OSXFuse

    ./build.sh

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
