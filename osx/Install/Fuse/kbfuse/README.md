### Building KBFuse for Keybase

Checkout the OSXFuse (osxfuse-3.0.9) version:

    rm -rf osxfuse
    git clone --recursive -b osxfuse-3.0.9 git://github.com/osxfuse/osxfuse.git osxfuse

Run script to search/replace osxfuse to kbfuse:

    sh rename.sh
    # HACK: Run again if it errors (it gets confused)
    sh rename.sh

Clean and build the distribution:

    sudo rm -rf /tmp/kbfuse*
    cd osxfuse
    ./build.sh -t fsbundle

If you get an error compiling you might have to run `brew link gettext --force` (see https://github.com/osxfuse/osxfuse/issues/149).

    cd ..
    rm -rf kbfuse.bundle
    ditto /tmp/kbfuse/fsbundle/kbfuse.fs kbfuse.bundle

Sign the kext:

    codesign --verbose --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Contents/Extensions/10.10/kbfuse.kext
    codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle

To verify kext signature:

    codesign -dvvvv kbfuse.bundle/Contents/Extensions/10.10/kbfuse.kext
    codesign -dvvvv kbfuse.bundle

### Manual Install

If you are upgrading you should uninstall first.

To install:

    sudo /bin/cp -RfX kbfuse.bundle /Library/Filesystems/kbfuse.fs

### Uninstall

Don't try to kextunload unless you have everything unmounted.

    // Check for any mounts (if there are you need to umount)
    mount -t kbfuse

    sudo kextunload -b com.github.osxfuse.filesystems.osxfuse
    sudo rm -rf /Library/Filesystems/kbfuse.fs

### Verifying

After install if you are having problems loading the kext:

    sudo kextutil -l /Library/Filesystems/kbfuse.fs/Contents/Extensions/10.10/kbfuse.kext

View kext status:

    sudo kextstat -b com.github.kbfuse.filesystems.kbfuse
