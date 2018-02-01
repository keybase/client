## Install

### Pre-requisites

 * appdmg (`npm install -g appdmg`)
 * xcpretty (`gem install xcpretty`)
 * Xcode 8.3.3 from https://developer.apple.com/download/more
   * Install it in `/Applications`, and rename it "XCode8" if you already have a
     Different Xcode version installed.
 * Xcode command line tools

### Build the Installer

You probably want to bump the version of the installer in both the "Bundle version" (CFBundleVersion)
and the "Bundle version string, short" (CFBundleShortVersionString) in [Installer/Info.plist](/osx/Installer/Info.plist).

Prepare your Xcode environment:

```
sudo xcode-select -s /Applications/Xcode8.app/Contents/Developer
```

Install the developer certificate chain by cloning the
`keybase://team/keybase.builds/meta` repo, and installing
`credentials/kbfuse-signing-cert/keybase-cert.p12` (there's a password
file in the same directory).

Open Xcode 8, go to "Xcode -> Preferences...", go to the "Accounts"
tab, and click the + to "Add Apple ID...".  Enter the gmail address
and Apple password found in the `credentials/apple-dev.txt` file in
the above-mentioned `meta` repo.

Then you should be ready to build:

```sh
./build_installer.sh
```

### Test the Installer

```sh
./build/KeybaseInstaller.app/Contents/MacOS/Keybase --app-path=/Applications/Keybase.app --run-mode=prod --timeout=10 --install-helper
```

### Releasing Installer

Upload the build KeybaseInstaller-x.y.z-darwin.tgz to the s3://prerelease.keybase.io/darwin-package folder.

Update the scripts that reference the older version such to include this version:
- [packaging/desktop/package_darwin.sh](/packaging/desktop/package_darwin.sh)
- [packaging/desktop/kbfuse.sh](/packaging/desktop/kbfuse.sh)

The installer is bundled into the Keybase.app, in `Keybase.app/Contents/Resources/KeybaseInstaller.app`.
