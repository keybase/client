## KBFuse

KBFuse is OSXFuse "branded" for Keybase. This is so we can maintain, install and upgrade fuse without
conflicting with existing OSXFuse installs. It also allows us to sign the kext with our certificate instead
of relying on 3rd party builds from other developers.

### Building KBFuse from OSXFuse

Checkout the OSXFuse (osxfuse-3.1.0) version:

    rm -rf osxfuse
    git clone --recursive -b osxfuse-3.1.0 git://github.com/osxfuse/osxfuse.git osxfuse

Run script to search/replace osxfuse to kbfuse:

    sh rename.sh
    # HACK: Run again if it errors (TODO: Fix this)
    sh rename.sh

Clean and build the distribution:

    sudo rm -rf /tmp/kbfuse*
    cd osxfuse
    ./build.sh -t fsbundle

If you get an error compiling you might have to run `brew link gettext --force` (see https://github.com/osxfuse/osxfuse/issues/149).

    cd ..
    rm -rf kbfuse.bundle
    ditto /tmp/kbfuse/fsbundle/kbfuse.fs kbfuse.bundle

You should also backup the /tmp/kbfuse/fsbundle directory in case you need debug symbols later (TODO: Add steps for this)

Sign the kext:

    codesign --verbose --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Extensions/10.10/kbfuse.kext
    codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle

Note that you want the May version of our certificate installed. The March version doesn't sign kext's.

To verify kext signature:

    codesign -dvvvv kbfuse.bundle/Contents/Extensions/10.10/kbfuse.kext
    codesign -dvvvv kbfuse.bundle

### Manual Install

If you are upgrading you should uninstall first.

To install:

    sudo /bin/cp -RfX kbfuse.bundle /Library/Filesystems/kbfuse.fs
    sudo chmod +s /Library/Filesystems/kbfuse.fs/Contents/Resources/load_kbfuse

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
