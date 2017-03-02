// @flow
import {NativeModules} from 'react-native'

const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine

// TODO
function tmpFile (suffix: string): string {
  return `${nativeBridge.tmpDir}${suffix}`
}

function downloadFilePath (suffix: string): string {
  throw new Error('Unimplemented')
}

function copy (from: string, to: string) {
  throw new Error('Unimplemented')
}

function exists (from: string, to: string): boolean {
  // FIXME implement
  return false
}

export {
  copy,
  exists,
  downloadFilePath,
  tmpFile,
}
