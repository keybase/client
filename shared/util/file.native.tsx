import {StatResult, WriteStream, Encoding} from './file'

export function tmpDir(): string {
  return require('rn-fetch-blob').default.fs.dirs.CacheDir
}

export function tmpFile(suffix: string): string {
  return `${tmpDir()}/${suffix}`
}

export function copy(from: string, to: string): Promise<boolean> {
  return require('rn-fetch-blob').default.fs.cp(from, to)
}

export function exists(filepath: string): Promise<boolean> {
  return require('rn-fetch-blob').default.fs.exists(filepath)
}

export function stat(filepath: string): Promise<StatResult> {
  // @ts-ignore codemod-issue
  return require('rn-fetch-blob')
    .default.fs.stat(filepath)
    .then(stats => ({lastModified: stats.lastModified, size: stats.size}))
}

export function writeStream(filepath: string, encoding: Encoding, append?: boolean): Promise<WriteStream> {
  return require('rn-fetch-blob').default.fs.writeStream(filepath, encoding, append)
}

export function unlink(filepath: string): Promise<void> {
  return require('rn-fetch-blob').default.fs.unlink(filepath)
}

export function readFile(filepath: string, encoding: Encoding): Promise<any> {
  return require('rn-fetch-blob').default.fs.readFile(filepath, encoding)
}

export const cachesDirectoryPath = tmpDir()
export const downloadFolder = ''
