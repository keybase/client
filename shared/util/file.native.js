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
  return RNFS.exists(filepath)
}

function writeFile (filepath: string, contents: string, encoding?: string): Promise<void> {
  return RNFS.writeFile(filepath, contents, encoding)
}

const cachesDirectoryPath = RNFS.CachesDirectoryPath

export {
  cachesDirectoryPath,
  copy,
  exists,
  downloadFilePath,
  tmpFile,
  writeFile,
}
