# Linking native dependencies

To add new native dependencies, you should `yarn add` it like usual. Then you can run `react-native link <packagename>`, and it will add a line like this to `Podfile`:

```
pod 'lottie-react-native', :path => '../node_modules/lottie-react-native'
```

Run `pod install` in this directory and you're good to go.

No extra libraries should be added in xcode under "Keybase" > "Build Phases" > "Link Binary With Libraries".
