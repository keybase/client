import RNFetchBlob from 'rn-fetch-blob'
import {findAvailableFilename} from './file.shared'
import {Encoding} from './file'

function tmpDir() {
  return RNFetchBlob.fs.dirs.CacheDir
}

export function downloadFilePathNoSearch(filename: string) {
  return `${tmpDir()}/${filename}`
}

export function downloadFilePath(suffix: string) {
  return findAvailableFilename(exists, `${tmpDir()}/${suffix}`)
}

export function copy(from: string, to: string) {
  return RNFetchBlob.fs.cp(from, to)
}

function exists(filepath: string) {
  return RNFetchBlob.fs.exists(filepath)
}

export function writeStream(filepath: string, encoding: Encoding, append?: boolean) {
  return RNFetchBlob.fs.writeStream(filepath, encoding, append)
}

export function unlink(filepath: string) {
  return RNFetchBlob.fs.unlink(filepath)
}

export function readFile(filepath: string, encoding: Encoding) {
  return RNFetchBlob.fs.readFile(filepath, encoding)
}

export const cachesDirectoryPath = tmpDir()
export const downloadFolder = ''
