## Keybase for iOS

### Project Setup

```sh
# Install CocoaPods (if not installed)
sudo gem install cocoapods
pod setup

# Generate workspace
pod install

# Open workspace (not xcodeproj)
open Keybase.xcworkspace
```

Then select the target ```Keybase``` and run.

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
