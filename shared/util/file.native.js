// @flow
import RNFetchBlob from 'react-native-fetch-blob'
import {findAvailableFilename} from './file.shared'

function tmpDir (): string {
  return RNFetchBlob.fs.dirs.CacheDir
}

function tmpFile (suffix: string): string {
  return `${tmpDir()}/${suffix}`
}

function downloadFilePath (suffix: string): Promise<string> {
  return findAvailableFilename(exists, `${tmpDir()}/${suffix}`)
}

function copy (from: string, to: string): Promise<void> {
  return RNFetchBlob.fs.cp(from, to)
}

function exists (filepath: string): Promise<boolean> {
  return RNFetchBlob.fs.exists(filepath)
}

function writeFile (filepath: string, contents: string, encoding?: string): Promise<void> {
  return RNFetchBlob.fs.createFile(filepath, '', encoding).then(() => RNFetchBlob.fs.writeFile(filepath, contents, encoding))
}

function writeStream (filepath: string, encoding: string, append?: boolean): Promise<*> {
  return RNFetchBlob.fs.createFile(filepath, '', encoding).then(() => RNFetchBlob.fs.writeStream(filepath, encoding, append))
}

const cachesDirectoryPath = tmpDir()

export {
  cachesDirectoryPath,
  copy,
  exists,
  downloadFilePath,
  tmpDir,
  tmpFile,
  writeFile,
  writeStream,
}
