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

It's possible to build for many macOS versions but it requrues a patched Xcode.
So are targeting 11+ now. We'll build for macOS 11, and make a symlink of
macOS 12 All these are handled by the build script, but we'll need the
appropriate SDKs to build against.

Xcode 13 (13.0) is the latest version that includes the macOS 11 SDK, so we'll
need it installed on the macOS where you build the KBFuse bundle. I have Xcode
13.2.1 installed as well but not sure it's needed

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

    VERSION=4.2.4 ./build.sh

This should generate a kbfuse.bundle (and fsbundle.tgz, that includes debug symbols)
which you can submit for PR.

This bundle is included in the KeybaseInstaller.app, so you'll need to build a new
installer, see [Building the Installer](/osx/Scripts/README.md).

Versioning can be tricky here, here are some tips from last time:

- Build against the newest macOS SDK
- Specify an old build target (like 12.3)
- Manually fixup Info.plist for the extension, since the Fuse build script puts the wrong values in for the minimum version and kext dependencies.
- Make sure the name in the Info.plist doesn't have a version number after it.
- `sudo kmutil log show` is a great way to see what is happening.

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

    sudo kextutil -l /Library/Filesystems/kbfuse.fs/Contents/Extensions/11/kbfuse.kext

View kext status:

    sudo kextstat -b com.github.kbfuse.filesystems.kbfuse
