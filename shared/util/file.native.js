// @flow
import RNFetchBlob from 'react-native-fetch-blob'
import {findAvailableFilename} from './file.shared'

import type {StatResult} from './file'

function tmpDir(): string {
  return RNFetchBlob.fs.dirs.CacheDir
}

function tmpFile(suffix: string): string {
  return `${tmpDir()}/${suffix}`
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
  return RNFetchBlob.fs.stat(filepath).then(stats => ({size: stats.size}))
}

const cachesDirectoryPath = tmpDir()

export {cachesDirectoryPath, copy, exists, downloadFilePath, stat, tmpDir, tmpFile}
