### Building OSXFuse for Keybase

Checkout the OSXFuse (osxfuse-3.0.7) version:

    rm -rf osxfuse
    git clone --recursive -b osxfuse-3.0.7 git://github.com/osxfuse/osxfuse.git osxfuse
    cd osxfuse

Clean and build the distribution:

    sudo rm -rf /tmp/osxfuse*

    ./build.sh -t distribution

If you get an error compiling you might have to run `brew link gettext --force` (see https://github.com/osxfuse/osxfuse/issues/149).

    cd ..
    rm -rf osxfuse.bundle
    ditto /tmp/osxfuse/fsbundle/osxfuse.fs osxfuse.bundle

Sign the kext:

    codesign --verbose --sign "Developer ID Application: Keybase, Inc." osxfuse.bundle/Contents/Extensions/10.10/osxfuse.kext
    codesign --verbose --force --deep --sign "Developer ID Application: Keybase, Inc." osxfuse.bundle

To verify kext signature:

    codesign -dvvvv osxfuse.bundle/Contents/Extensions/10.10/osxfuse.kext
    codesign -dvvvv osxfuse.bundle

### Manual Install

If you are upgrading you should uninstall first.

To install:

    sudo /bin/cp -RfX osxfuse.bundle /Library/Filesystems/osxfuse.fs
    sudo chmod +s /Library/Filesystems/osxfuse.fs/Contents/Resources/load_osxfuse

### Uninstall

Don't try to kextunload unless you have everything unmounted. Otherwise it will fail forever until a reboot.

    // Check for any mounts (if there are you need to umount)
    mount -t osxfusefs

    sudo kextunload -b com.github.osxfuse.filesystems.osxfuse
    sudo rm -rf /Library/Filesystems/osxfuse.fs

### Verifying

After install if you are having problems loading the kext:

    sudo kextutil -l /Library/Filesystems/osxfuse.fs/Contents/Extensions/10.10/osxfuse.kext

View kext status:

    sudo kextstat -b com.github.osxfuse.filesystems.osxfuse
