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

declare module 'qrcode-generator' {
  const gen: (
    n: number,
    s: string
  ) => {
    addData: (s: string) => void
    make: () => void
    getModuleCount: () => number
    createDataURL: (n: number, z: number, rgb: [number, number, number]) => string
  }
  export default gen
}
