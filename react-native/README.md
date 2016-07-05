
**Attention, please.**

This code is a work in progress, and we publish it for full transparency. You can review the source code, but:

 - you shouldn't just run this code without reading it, as it may have bugs or stubbed out crypto
 - it might not do exactly what it says it is doing

If you really want to install Keybase, please return to the [top level Readme.md](https://github.com/keybase/client/blob/master/README.md) for official release instructions.

----------

## Keybase

### Project Status

Hi everyone! This folder's code is *not* ready for prime time. Use at your own risk (and never against production!)
We are iterating quickly and a lot of the code is changing every day.

### Project Setup

#### General (both android and ios)

Follow the [React Native Getting Started guide](https://facebook.github.io/react-native/docs/getting-started.html) for the platforms you intend to develop on.

```sh
npm install
```

Due to the react-native packager not handling symlinks (https://github.com/facebook/react-native/issues/637) we're watching our shared folder and copying the files over as they change. We use watchman to watch the folder and rsync to copy over the changes

```sh
# Install watchman (the npm version has issues)
brew update
brew install watchman

# Start watching changes
npm run watch
```

#### iOS

Build the go keybaselib

```sh
npm run gobuild-ios
```

Open workspace (not xcodeproj):

```sh
open ios/Keybase.xcworkspace
```

Then select the target `Keybase` and run.

#### Android Specific

Follow instructions at https://facebook.github.io/react-native/docs/getting-started.html
to install and configure Android.

```sh
# inside react-native/

# Build the go keybaselib
npm run gobuild-android

# This will install the app on your device
react-native run-android
```

Currently there is a text relocation bug: https://github.com/golang/go/issues/10807
which affects android versions L

latest go (from HEAD) along wth latest gomobile (from go get) seem to fix the issue.

On mac with brew you can simply do:
```sh
# Latest Go
brew upgrade --HEAD go

# Latest Go Mobile
rm $GOPATH/bin/gomobile
go get -u golang.org/x/mobile/cmd/gomobile && gomobile init

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
npm install -g flow
```

See [the JS style guide](standardjs.com)
We're extending standard to be more strict in some cases (see our .eslintrc)

Visit [standardjs.com](http://standardjs.com/#text-editor-plugins) to find plugins for your editor of choice
We're including local plugins which requires you to run eslint locally as well (see https://github.com/eslint/eslint/issues/1238)
For vim uses you likely should use this script: https://github.com/eslint/eslint/issues/1238#issuecomment-139471958

Currently we're using ES6/7 extensions through babel (https://babeljs.io/docs/learn-es2015/)

We're using redux to store our data and mutate it (http://rackt.github.io/redux/index.html)

All files and folders should use the naming convention:

```
/this-is-a-folder/a-file.js

/my-component/index.js (common component)
/my-component/index.mobile.js (shared ios/android component)
/my-component/index.desktop.js (electron component)

/smart-component/index.js (smart component)
/smart-component/index.render.android.js (android version)
/smart-component/index.render.ios.js (ios version)
/smart-component/index.render.desktop.js (electron version)
```

If you run into weird issues with your packager this may be due to a stale cache. Run this command to wipe your local cache
```
npm run packager-wipe-cache
```
