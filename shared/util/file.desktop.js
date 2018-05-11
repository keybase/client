// @flow
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {findAvailableFilename} from './file.shared'
import {cacheRoot} from '../constants/platform.desktop'

import type {StatResult} from './file'

export function tmpDir(): string {
  return cacheRoot
}

export function tmpFile(suffix: string): string {
  return path.join(tmpDir(), suffix)
}

export function tmpRandFile(suffix: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (err, buf) => {
      if (err) {
        reject(err)
        return
      }
      resolve(path.join(tmpDir(), buf.toString('hex') + suffix))
    })
  })
}

// TODO make this a user setting
const downloadFolder = __STORYBOOK__ ? '' : path.join(os.homedir(), 'Downloads')

export function downloadFilePathNoSearch(filename: string): string {
  return path.join(downloadFolder, filename)
}

export function downloadFilePath(suffix: string): Promise<string> {
  return findAvailableFilename(exists, path.join(downloadFolder, suffix))
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
  const initDir = path.isAbsolute(target) ? path.sep : ''
  target.split(path.sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(parentDir, childDir)
    if (!fs.existsSync(curDir)) {
      fs.mkdirSync(curDir)
    }

    return curDir
  }, initDir)
}

export function copy(from: string, to: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirp(path.dirname(to))
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

export function writeStream(filepath: string, encoding: string, append?: boolean): Promise<void> {
  return Promise.reject(new Error('not implemented'))
}
