## Install

### Pre-requisites

* appdmg (`npm install -g appdmg`)
* xcpretty (`gem install xcpretty`)
* Xcode 8.3.3 from https://developer.apple.com/download/more
  * Install it in `/Applications`, and rename it "XCode8" if you already have a
    Different Xcode version installed.
  * On macOS 10.14, using latest Xcode works.
* Xcode command line tools

### Build the Installer

You probably want to bump the version of the installer in both the "Bundle version" (CFBundleVersion)
and the "Bundle version string, short" (CFBundleShortVersionString) in [Installer/Info.plist](/osx/Installer/Info.plist). If you updated KBFuse, bump those versions too.

Prepare your Xcode environment:

```
sudo xcode-select -s /Applications/Xcode8.app/Contents/Developer
```

Install the developer certificate chain by cloning the
`keybase://team/keybase.keymasters/apple-dev` repo, and installing the
cert with `open keybase-cert.p12` (there's a cert.pw file in the same
directory).

Depending on your local xcode settings, you might also need to install
the old developer cert, located in `keybase-dev-cert.p12`.  This won't
be used to sign the final product, but it might be need for some of
the interim steps, if your xcode setup pre-dates the new certificate.

Open Xcode 8, go to "Xcode -> Preferences...", go to the "Accounts"
tab, and click the + to "Add Apple ID...". Enter the gmail address
and Apple password found in the `apple.txt` file in
the above-mentioned `apple-dev` repo. After adding the account, you might need to
click "Download Manual Profiles" (I did, but not sure if it was actually
helpful), and open the Keybaes project, and let it update signing related
stuff. For me it showed a green check mark followed by "Signing update
finished".

Then you should be ready to build:

```sh
./build_installer.sh
```

If it complains and asks to run `pod install`, do it.

### Test the Installer

```sh
./build/KeybaseInstaller.app/Contents/MacOS/Keybase --app-path=/Applications/Keybase.app --run-mode=prod --timeout=10 --install-helper
```

### Releasing Installer

Upload the build KeybaseInstaller-x.y.z-darwin.tgz to the s3://prerelease.keybase.io/darwin-package folder.

Update the scripts that reference the older version such to include this version:

* [packaging/desktop/package_darwin.sh](/packaging/desktop/package_darwin.sh)
* [packaging/desktop/kbfuse.sh](/packaging/desktop/kbfuse.sh)

The installer is bundled into the Keybase.app, in `Keybase.app/Contents/Resources/KeybaseInstaller.app`.
