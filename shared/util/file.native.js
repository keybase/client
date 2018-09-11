// @flow
import RNFetchBlob from 'rn-fetch-blob'
import {findAvailableFilename} from './file.shared'

import type {StatResult} from './file'

function tmpDir(): string {
  return RNFetchBlob.fs.dirs.CacheDir
}

function tmpFile(suffix: string): string {
  return `${tmpDir()}/${suffix}`
}

function downloadFilePathNoSearch(filename: string): string {
  return `${tmpDir()}/${filename}`
}

function downloadFilePath(suffix: string): Promise<string> {
  return findAvailableFilename(exists, `${tmpDir()}/${suffix}`)
}

function copy(from: string, to: string): Promise<void> {
  return RNFetchBlob.fs.cp(from, to)
}

function exists(filepath: string): Promise<boolean> {
  return RNFetchBlob.fs.exists(filepath)
}

function stat(filepath: string): Promise<StatResult> {
  return RNFetchBlob.fs.stat(filepath).then(stats => ({size: stats.size, lastModified: stats.lastModified}))
}

function writeStream(filepath: string, encoding: string, append?: boolean): Promise<void> {
  return RNFetchBlob.fs.writeStream(filepath, encoding, append)
}

function unlink(filepath: string): Promise<void> {
  return RNFetchBlob.fs.unlink(filepath)
}

const cachesDirectoryPath = tmpDir()

export {
  cachesDirectoryPath,
  copy,
  exists,
  downloadFilePath,
  stat,
  tmpDir,
  tmpFile,
  unlink,
  writeStream,
  downloadFilePathNoSearch,
}
