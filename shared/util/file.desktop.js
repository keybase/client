// @flow
import crypto from 'crypto'
import fs from 'fs'
import fsExtra from 'fs-extra'
import os from 'os'
import path from 'path'

import {cacheRoot} from '../constants/platform'

function tmpDir (): string {
  return cacheRoot
}

function tmpFile (suffix: string): string {
  return path.join(tmpDir(), suffix)
}

function tmpRandFile (suffix: string): Promise<string> {
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

function downloadFilePath (suffix: string): string {
  return _findAvailableFilename(path.join(downloadFolder, suffix))
}

function exists (filepath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.exists(filepath, exists => {
      resolve(exists)
    })
  })
}

function _findAvailableFilename (filepath: string): string {
  const {name, ext, dir} = path.parse(filepath)
  for (let i = 1; i < 1000; i++) {
    if (fs.existsSync(filepath)) {
      filepath = path.format({
        dir,
        ext,
        name: `${name} (${i})`,
      })
    } else {
      return filepath
    }
  }

  // They have more than 1k of the same file??
  return filepath
}

function copy (from: string, to: string) {
  fsExtra.copySync(from, to)
}

// TODO implemented for mobile, not here
function writeFile (filepath: string, contents: string, encoding?: string): Promise<void> {
  return Promise.reject(new Error('not implemented'))
}

// TODO implemented for mobile, not here
const cachesDirectoryPath = ''

export {
  cachesDirectoryPath,
  copy,
  downloadFilePath,
  exists,
  tmpDir,
  tmpFile,
  tmpRandFile,
  writeFile,
}
