// @flow
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import * as Path from '../util/path.desktop'
import {findAvailableFilename} from './file.shared'
import {cacheRoot} from '../constants/platform.desktop'

import type {StatResult, WriteStream} from './file'

export function tmpDir(): string {
  return cacheRoot
}

export function tmpFile(suffix: string): string {
  return Path.join(tmpDir(), suffix)
}

export function tmpRandFile(suffix: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (err, buf) => {
      if (err) {
        reject(err)
        return
      }
      resolve(Path.join(tmpDir(), buf.toString('hex') + suffix))
    })
  })
}

export const downloadFolder = __STORYBOOK__
  ? ''
  : process.env.XDG_DOWNLOAD_DIR || Path.join(os.homedir(), 'Downloads')

export function downloadFilePathNoSearch(filename: string): string {
  return Path.join(downloadFolder, filename)
}

export function downloadFilePath(suffix: string): Promise<string> {
  return findAvailableFilename(exists, Path.join(downloadFolder, suffix))
}

export function exists(filepath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.access(filepath, fs.constants.F_OK, err => {
      resolve(!err)
    })
  })
}

export function stat(filepath: string): Promise<StatResult> {
  return new Promise((resolve, reject) => {
    fs.stat(filepath, (err, stats) => {
      if (err) {
        return reject(err)
      }
      resolve({size: stats.size, lastModified: stats.mtime.getTime()})
    })
  })
}

export function mkdirp(target: string) {
  const initDir = Path.isAbsolute(target) ? path.sep : ''
  target.split(path.sep).reduce((parentDir, childDir) => {
    const curDir = Path.resolve(parentDir, childDir)
    if (!fs.existsSync(curDir)) {
      fs.mkdirSync(curDir)
    }

    return curDir
  }, initDir)
}

export function copy(from: string, to: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirp(Path.dirname(to))
    fs.readFile(from, (err, data) => {
      if (err) {
        reject(err)
      } else {
        fs.writeFile(to, data, err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      }
    })
  })
}

export function unlink(filepath: string): Promise<void> {
  return new Promise((resolve, reject) => fs.unlink(filepath, () => resolve()))
}

export function writeStream(filepath: string, encoding: string, append?: boolean): Promise<WriteStream> {
  const ws = fs.createWriteStream(filepath, {encoding, flags: append ? 'a' : 'w'})
  return Promise.resolve({
    close: () => ws.end(),
    write: d => {
      ws.write(d)
    },
  })
}

export function readFile(filepath: string, encoding: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // $FlowIssue
    fs.readFile(filepath, {encoding}, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}
