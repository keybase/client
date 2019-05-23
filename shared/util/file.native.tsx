import RNFetchBlob from 'rn-fetch-blob'
import {findAvailableFilename} from './file.shared'

import {StatResult, WriteStream, Encoding} from './file'

export function tmpDir(): string {
  return RNFetchBlob.fs.dirs.CacheDir
}

export function tmpFile(suffix: string): string {
  return `${tmpDir()}/${suffix}`
}

export function downloadFilePathNoSearch(filename: string): string {
  return `${tmpDir()}/${filename}`
}

export function downloadFilePath(suffix: string): Promise<string> {
  return findAvailableFilename(exists, `${tmpDir()}/${suffix}`)
}

export function copy(from: string, to: string): Promise<boolean> {
  return RNFetchBlob.fs.cp(from, to)
}

export function exists(filepath: string): Promise<boolean> {
  return RNFetchBlob.fs.exists(filepath)
}

export function stat(filepath: string): Promise<StatResult> {
  // @ts-ignore codemod-issue
  return RNFetchBlob.fs.stat(filepath).then(stats => ({lastModified: stats.lastModified, size: stats.size}))
}

export function writeStream(filepath: string, encoding: Encoding, append?: boolean): Promise<WriteStream> {
  return RNFetchBlob.fs.writeStream(filepath, encoding, append)
}

export function unlink(filepath: string): Promise<void> {
  return RNFetchBlob.fs.unlink(filepath)
}

export function readFile(filepath: string, encoding: Encoding): Promise<any> {
  return RNFetchBlob.fs.readFile(filepath, encoding)
}

export const cachesDirectoryPath = tmpDir()
export const downloadFolder = ''
