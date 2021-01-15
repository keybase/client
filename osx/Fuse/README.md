## KBFuse

KBFuse is OSXFuse (or Fuse for MacOS) "branded" for Keybase. This is so we can maintain, install and upgrade fuse without
conflicting with existing OSXFuse installs. It also allows us to sign the kext with our certificate instead
of relying on 3rd party binaries shipped from other developers.

### Pre-requisites

#### Xcode

First of all, we can't have a kernel extension built for a newer kernel and
run in on older kernels, but we can generally have a kernel extension built for
an older kernel and run it on newer kernels. So we'll try to build for the
oldest possible (compatible) kernel, to have a fewer kernel extensions built as
possible.

For OSXFuse, it's possible to use a kernel extension that's built against the
macOS 10.14 SDK on macOS 10.12, 10.13, 10.14 and 10.15. However, to build
against 10.11 we need to be on an older macOS. So are targeting 10.14+ now.
We'll build for 10.14, then we'll make symlinks for 10.15. All these are
handled by the build script, but we'll need the appropriate SDKs to build
against.

Xcode 10.3 is the latest version that includes the macOS 10.14 SDK, so we'll
need it installed on the macOS where you build the KBFuse bundle. Additionally,
macOS 11 needs to be built with Xcode 12.3, so we need that as well.

Older versions of Xcode can be downloaded from the [Apple official developer
site](https://developer.apple.com/download/more/). It has to live under
`/Applications`, but under a different name, e.g. `/Applications/Xcode-10.3`.
Don't worry about making the naming scheme exact, as the OSXFuse builder is
able to spotlight different versions automatically.
[Here](https://medium.com/@hacknicity/working-with-multiple-versions-of-xcode-e331c01aa6bc)'s
a blog post that explains the process of having multiple Xcode installed on the
same machine.

#### Signing certificate

You'll also need the Keybase signing certificate. Ask around if you don't have
access to it. Also see
[this](https://github.com/keybase/client/tree/master/osx/Scripts#build-the-installer)
for some pointers.

### Building KBFuse

    VERSION=4.0.4 ./build.sh

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

