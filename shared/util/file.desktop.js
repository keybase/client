// @flow
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {findAvailableFilename} from './file.shared'
import {cacheRoot} from '../constants/platform.desktop'

import type {StatResult} from './file'

function tmpDir(): string {
  return cacheRoot
}

function tmpFile(suffix: string): string {
  return path.join(tmpDir(), suffix)
}

function tmpRandFile(suffix: string): Promise<string> {
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

function downloadFilePath(suffix: string): Promise<string> {
  return findAvailableFilename(exists, path.join(downloadFolder, suffix))
}

function exists(filepath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.access(filepath, fs.constants.F_OK, err => {
      resolve(!err)
    })
  })
}

function stat(filepath: string): Promise<StatResult> {
  return new Promise((resolve, reject) => {
    fs.stat(filepath, (err, stats) => {
      if (err) {
        return reject(err)
      }
      resolve({size: stats.size, lastModified: stats.mtime.getTime()})
    })
  })
}

function mkdirp(target) {
  const initDir = path.isAbsolute(target) ? path.sep : ''
  target.split(path.sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(parentDir, childDir)
    if (!fs.existsSync(curDir)) {
      fs.mkdirSync(curDir)
    }

    return curDir
  }, initDir)
}

function copy(from: string, to: string) {
  mkdirp(path.dirname(to))
  fs.writeFileSync(to, fs.readFileSync(from))
}

function unlink(filepath: string): Promise<void> {
  return new Promise((resolve, reject) => fs.unlink(filepath, () => resolve()))
}

function writeStream(filepath: string, encoding: string, append?: boolean): Promise<*> {
  return Promise.reject(new Error('not implemented'))
}

export {
  copy,
  downloadFilePath,
  exists,
  stat,
  tmpDir,
  tmpFile,
  tmpRandFile,
  unlink,
  writeStream,
}
