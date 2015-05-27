
### Building OSXFuse for Keybase

Checkout the OSXFuse (osxfuse-2.7.6) version:

    git clone --recursive -b osxfuse-2.7.6 git://github.com/osxfuse/osxfuse.git osxfuse
    cd osxfuse

In `build.sh` replace `M_KEXT_ID` with `keybase.osxfuse.filesystems.osxfusefs`.

In kext/common/fuse_version.h replace `OSXFUSE_IDENTIFIER_LITERAL` with `keybase.osxfuse`.

Clean and build the small dist:

    sh build.sh -t clean
    sh build.sh -t smalldist

Create our own bundle from the kext and some support files:

    cd ../Fuse

    rm -rf kbfuse.bundle
    mkdir -p kbfuse.bundle

    ditto /tmp/osxfuse-core-10.10-2.7.6/osxfuse/Library/Filesystems/osxfusefs.fs/Contents kbfuse.bundle/Contents/
    ditto /tmp/osxfuse-core-10.10-2.7.6/osxfuse/Library/Filesystems/osxfusefs.fs/Support/osxfusefs.kext kbfuse.bundle/Support/osxfusefs.kext
    ditto /tmp/osxfuse-core-10.10-2.7.6/osxfuse/Library/Filesystems/osxfusefs.fs/Support/load_osxfusefs kbfuse.bundle/Support/load_osxfusefs
    ditto /tmp/osxfuse-core-10.10-2.7.6/osxfuse/Library/Filesystems/osxfusefs.fs/Support/mount_osxfusefs kbfuse.bundle/Support/mount_osxfusefs

Sign the kext:

    codesign --verbose --sign "Developer ID Application: Keybase, Inc." kbfuse.bundle/Support/osxfusefs.kext

To verify kext signature:

    codesign -dvvv kbfuse.bundle/Support/osxfusefs.kext

Make sure the entire bundle is included in the main Keybase target.

### Manual Install

The app will install it but if you want to install it manually:

    sudo ditto kbfuse.bundle /Library/Filesystems/kbfuse.fs
    sudo chown -R 0:0 /Library/Filesystems/kbfuse.fs
    sudo chmod -R 755 /Library/Filesystems/kbfuse.fs

### Verifying

After install if you are having problems loading the kext:

    sudo kextutil -l /Library/Filesystems/kbfuse.fs/Support/osxfusefs.kext

View kext status:

    sudo kextstat -b keybase.osxfuse.filesystems.osxfusefs

