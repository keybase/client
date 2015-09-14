## Keybase for iOS

### Project Setup

```sh
# Install CocoaPods (if not installed)
sudo gem install cocoapods
pod setup

# Generate workspace
pod install

# Setup npm
npm install

# Setup golang mobile
go get golang.org/x/mobile/cmd/gomobile
gomobile init

# Build the keybase go framwork
npm run gobuild

# Open workspace (not xcodeproj)
open Keybase.xcworkspace
```

Then select the target ```Keybase``` and run.

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
```

See [the JS style guide](standardjs.com)
Visit [standardjs.com](http://standardjs.com/#text-editor-plugins) to find plugins for your editor of choice

Currently we're using ES6 style classes and styles
