declare module 'electron-positioner' {
  type ignore = unknown
  export default ignore
}
declare module '@react-native/assets-registry/registry' {
  type PackagerAsset = {[key: string]: unknown}
}

declare module 'expo-manifests' {
  type EASConfig = any
  type ExpoGoConfig = any
  type NewManifest = any
  type BareManifest = any
  type ManifestAsset = any
  type ManifestExtra = any
  type ClientScopingConfig = any
  type ExpoGoPackagerOpts = any
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

declare module 'base-64' {
  export const encode: (s: string) => string
  export const decode: (s: string) => string
}

declare module 'fastestsmallesttextencoderdecoder' {
  type ignore = unknown
  export default ignore
}

declare module 'rimraf' {
  export const rimrafSync: (s: string) => void
}

declare module 'emoji-datasource-apple/img/apple/sheets/64.png' {
  var png: string
  export default png
}

declare module 'react-is' {
  import * as React from 'react'
  export function isValidElementType(value: any): value is React.ElementType
}

declare module 'fs-extra' {
  import type {StatSyncFn, copyFileSync} from 'fs'
  export const copy: (src: string, dst: string) => Promise<void>
  export const copySync: (src: string, dst: string, options?: {dereference?: boolean}) => void
  export const removeSync: (src: string) => void
  export const statSync: StatSyncFn
  export const writeJsonSync: (dst: string, o: {}) => void
}

declare module 'mousetrap' {
  export const bind: (
    keys: Array<string> | string,
    cb: (e: {stopPropagation: () => void}, key: string) => void,
    type: 'keydown'
  ) => void
  export const unbind: (keys: Array<string> | string) => void
}

declare module 'url-parse' {
  export class URLParse {
    constructor(url: string)
    hostname: string
    protocol: string
    username: string
    port: string
    pathname: string
    query: string
    password: string
  }
  export default URLParse
}
