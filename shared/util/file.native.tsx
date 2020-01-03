import {WriteStream, Encoding} from './file'

export function writeStream(filepath: string, encoding: Encoding, append?: boolean): Promise<WriteStream> {
  return require('rn-fetch-blob').default.fs.writeStream(filepath, encoding, append)
}

export function readFile(filepath: string, encoding: Encoding): Promise<any> {
  return require('rn-fetch-blob').default.fs.readFile(filepath, encoding)
}

export const downloadFolder = ''
