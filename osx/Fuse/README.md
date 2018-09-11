## KBFuse

KBFuse is OSXFuse (or Fuse for MacOS) "branded" for Keybase. This is so we can maintain, install and upgrade fuse without
conflicting with existing OSXFuse installs. It also allows us to sign the kext with our certificate instead
of relying on 3rd party binaries shipped from other developers.

For simplicity, we'll drop 10.10 and only support 10.11+ for the fuse
extension. See the "Notes on 10.10" below for how to build for 10.10.

### Pre-requisites

#### Xcode

First of all, we can't have a kernel extension built for a newer kernel and
run in on older kernels, but we can generally have a kernel extension built for
an older kernel and run it on newer kernels. So we'll try to build for the
oldest possible (compatible) kernel, to have a fewer kernel extensions built as
possible.

For OSXFuse, it's possible to use a kernel extension that's built against the
macOS 10.11 SDK on macOS 10.12, 10.13, and 10.14. So we'll build for 10.11
kernel, then we'd make symlinks for 10.12, 10.13, and 10.14 whose target is
10.11. All these are handled by the build script, but we'll need the
appropriate SDKs to build against.

Xcode 7.3.1 is the latest version that includes the macOS 10.11 SDK, so we'll
need it installed on the macOS where you build the KBFuse bundle.

Older versions of Xcode can be downloaded from the [Apple official developer
site](https://developer.apple.com/download/more/). It has to live under
`/Applications`, but under a different name, e.g. `/Applications/Xcode-7.3.1`.
Don't worry about making the naming scheme exact, as the OSXFuse builder is
able to spotlight different versions automatically.
[Here](https://medium.com/@hacknicity/working-with-multiple-versions-of-xcode-e331c01aa6bc)'s
a blog post that explains the process of having multiple Xcode installed on the
same machine.

#### Signing certificate

You'll also need the Keybase signing certificate. Ask around if you don't have
access to it.

### Building KBFuse

    VERSION=3.6.3 ./build.sh

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

### Notes on 10.10:

Although we can use 10.11 extension on newer kernels, we can't use 10.10
extension on newer kernels. So to support all macOS versions starting from
10.10+, we'd need to build 2 kernel extensions, one for 10.10, and one for
10.11 and its newer siblings.

Xcode 6.4 is the latest version that includes the 10.10 SDK. So it needs to be
installed like we did with XCode 7.3.1. Unfortunately Xcode 6.4 is not
supported on macOS 10.14 anymore, so we'd need a build machine running 10.13 to
support all.

The build script is not setup up to build for 10.10 either. If this is needed,
we need to replace this line (in `osx/Fuse/build.sh`):

```
./build.sh -v 5 -t fsbundle -- -s 10.11 -d 10.11 --kext=10.11 --kext="10.12->10.11" --kext="10.13->10.11" --kext="10.14->10.11"
```

with

```
./build.sh -v 5 -t fsbundle -- -s 10.10 -d 10.10 --kext=10.10 --kext=10.11 --kext="10.12->10.11" --kext="10.13->10.11" --kext="10.14->10.11"
```
