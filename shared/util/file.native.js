// @flow
import RNFS from 'react-native-fs'

function tmpFile (suffix: string): string {
  return `${RNFS.CachesDirectoryPath}/${suffix}`
}

function downloadFilePath (suffix: string): string {
  return `${RNFS.CachesDirectoryPath}/${suffix}`
}

function copy (from: string, to: string) {
  throw new Error('Unimplemented')
}

function exists (filepath: string): Promise<boolean> {
  return false
  // Change to this when copy above is implemented
  // return RNFS.exists(filepath)
}

export {
  copy,
  exists,
  downloadFilePath,
  tmpFile,
}
