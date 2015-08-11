
### Building OSXFuse for Keybase

Checkout the OSXFuse (osxfuse-2.8.0) version:

    git clone --recursive -b osxfuse-2.7.6 git://github.com/osxfuse/osxfuse.git osxfuse
    cd osxfuse

In `build.sh` replace `M_KEXT_ID` with `keybase.osxfuse.filesystems.kbfuse`.
In `kext/common/fuse_version.h` replace `OSXFUSE_IDENTIFIER_LITERAL` with `keybase.osxfuse`.

In `kext/common/fuse_param.h` replace `OSXFUSE_BUNDLE_PATH` with `"/Library/Filesystems/kbfuse.fs"`.
In `kext/common/fuse_param.h` replace `OSXFUSE_DEVICE_BASENAME` to `kbfuse`.

Clean and build the small dist:

    sudo rm -rf /tmp/osxfuse-core-10.10-2.7.6/

    sh build.sh -t clean
    sh build.sh -t smalldist

If you get an error compiling you might have to run `brew link gettext --force`.
(see https://github.com/osxfuse/osxfuse/issues/149)

Create our own bundle from the kext and some support files:

    cd keybase/client/osx/Install/Fuse

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

If you want to install it manually:

    sudo ditto kbfuse.bundle /Library/Filesystems/kbfuse.fs
    sudo chown -R 0:0 /Library/Filesystems/kbfuse.fs
    sudo chmod -R 755 /Library/Filesystems/kbfuse.fs

### Verifying

After install if you are having problems loading the kext:

    sudo kextutil -l /Library/Filesystems/kbfuse.fs/Support/osxfusefs.kext

View kext status:

    sudo kextstat -b keybase.osxfuse.filesystems.osxfusefs

