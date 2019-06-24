# iOS Native Dependencies

We use [CocoaPods](https://cocoapods.org/) to manage our iOS dependencies. Install with:

```
brew install cocoapods
```

or

```
gem install cocoapods
```

Dependencies are vendored into `ios/Pods`, including React Native modules. For example:

```
# ios/Podfile

pod 'react-native-webview', :path => '../node_modules/react-native-webview'
```

will copy relevant native code from `node_modules/react-native-webview` into `ios/Pods` upon running `pod install`. When updating native dependencies using `yarn` you need to run `pod install` afterwards to have the code included in the iOS build.
