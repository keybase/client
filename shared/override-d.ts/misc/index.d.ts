declare module 'menubar'
declare module 'react-native/Libraries/Image/AssetRegistry' {
  type PackagerAsset = any
}

declare module '@react-spring/rafz' {
  type frameLoop = any
  var raf: {
    now: any
    batchedUpdates: any
  }
  type Timeout = any
  type Rafz = any
}
