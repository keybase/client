## Keybase

### Project Setup

#### General (both android and ios)

```sh
# Setup golang mobile
go get golang.org/x/mobile/cmd/gomobile
gomobile init

# Setup npm
npm install
```

#### iOS

Install CocoaPods (if not installed):

```sh
sudo gem install cocoapods
```

Install or update dependencies:

```sh
make dep-ios
```

Open workspace (not xcodeproj):

```sh
open ios/Keybase.xcworkspace
```

Then select the target `Keybase` and run.

#### Android

This will only work on an actual device or arm emulator. see: (https://github.com/golang/go/issues/10743)

```sh
make dep-android
```

To set the host for the JS files: Shake the device and choose 'Dev Settings | Debug server host for device'

### Release building

Make sure the code is set to use the bundled react js
In AppDelegate.m set


```
#define REACT_EMBEDDED_BUNDLE 1
```

Build the bundled react code
```
npm run reactbundle
```

### Xcode Settings

In Xcode, Preferences, Text Editing:

* Prefer indent using: Spaces
* Tab width: 2 spaces
* Indent width: 2 spaces

See [the objC style guide](../osx/STYLEGUIDE.md)

### Javascript settings

```
npm install -g standard
npm install -g babel-eslint
npm install -g flow
```

See [the JS style guide](standardjs.com)
Visit [standardjs.com](http://standardjs.com/#text-editor-plugins) to find plugins for your editor of choice

Currently we're using ES6/7 extensions through babel

If you run into weird issues with your packager this may be due to a stale cache. Run this command to wipe your local cache
```
npm run packager-wipe-cache
```
