
### Building OSXFuse for Keybase

Checkout the OSXFuse (osxfuse-2.8.0) version:

    rm -rf osxfuse
    git clone --recursive -b osxfuse-2.8.0 git://github.com/osxfuse/osxfuse.git osxfuse
    cd osxfuse

Clean and build the small dist:

    sudo rm -rf /tmp/osxfuse-core-10.10-2.8.0/

    sh build.sh -t clean
    sh build.sh -t smalldist

If you get an error compiling you might have to run `brew link gettext --force`.
(see https://github.com/osxfuse/osxfuse/issues/149)

Create our own bundle from the kext and some support files:

    cd keybase/client/osx/Install/Fuse

    rm -rf osxfusefs.bundle
    mkdir -p osxfusefs.bundle

    ditto /tmp/osxfuse-core-10.10-2.8.0/osxfuse/Library/Filesystems/osxfusefs.fs/Contents osxfusefs.bundle/Contents/
    ditto /tmp/osxfuse-core-10.10-2.8.0/osxfuse/Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext osxfusefs.bundle/Support/osxfusefs.kext
    ditto /tmp/osxfuse-core-10.10-2.8.0/osxfuse/Library/Filesystems/osxfusefs.fs/Support/load_osxfusefs osxfusefs.bundle/Support/load_osxfusefs
    ditto /tmp/osxfuse-core-10.10-2.8.0/osxfuse/Library/Filesystems/osxfusefs.fs/Support/mount_osxfusefs osxfusefs.bundle/Support/mount_osxfusefs

Sign the kext:

    codesign --verbose --sign "Developer ID Application: Keybase, Inc." osxfusefs.bundle/Support/osxfusefs.kext

To verify kext signature:

    codesign -dvvv osxfusefs.bundle/Support/osxfusefs.kext

Make sure the entire bundle is included in the main Keybase target.

### Manual Install

If you want to install it manually:

    sudo ditto osxfusefs.bundle /Library/Filesystems/osxfusefs.fs
    sudo chown -R 0:0 /Library/Filesystems/osxfusefs.fs
    sudo chmod -R 755 /Library/Filesystems/osxfusefs.fs

### Uninstall

Don't try to kextunload unless you have everything unmounted. Otherwise it will fail forever until a reboot.

    sudo kextunload /Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext
    rm -rf /Library/Filesystems/osxfusefs.fs

### Verifying

After install if you are having problems loading the kext:

    sudo kextutil -l /Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext

View kext status:

    sudo kextstat -b com.github.osxfuse.filesystems.osxfusefs

