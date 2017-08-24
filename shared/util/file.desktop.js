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
const downloadFolder = path.join(os.homedir(), 'Downloads')

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
      resolve({size: stats.size})
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

// TODO implemented for mobile, not here
function writeFile(filepath: string, contents: string, encoding?: string): Promise<void> {
  return Promise.reject(new Error('not implemented'))
}

function writeStream(filepath: string, encoding: string, append?: boolean): Promise<*> {
  return Promise.reject(new Error('not implemented'))
}

// TODO implemented for mobile, not here
const cachesDirectoryPath = ''

export {
  cachesDirectoryPath,
  copy,
  downloadFilePath,
  exists,
  stat,
  tmpDir,
  tmpFile,
  tmpRandFile,
  writeFile,
  writeStream,
}
