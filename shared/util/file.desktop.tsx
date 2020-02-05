import fs from 'fs'
import os from 'os'
import {WriteStream, Encoding} from './file'
const {join} = KB.path
const {env} = KB.process

export const downloadFolder = __STORYBOOK__ ? '' : env.XDG_DOWNLOAD_DIR || join(os.homedir(), 'Downloads')

export function writeStream(filepath: string, encoding: string, append?: boolean): Promise<WriteStream> {
  const ws = fs.createWriteStream(filepath, {encoding, flags: append ? 'a' : 'w'})
  return Promise.resolve({
    close: () => ws.end(),
    write: d => {
      ws.write(d)
      return Promise.resolve()
    },
  })
}

export function readFile(filepath: string, encoding: Encoding): Promise<any> {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, {encoding}, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
