// @flow

import os from 'os'
import path from 'path'
import fs from 'fs'
import fsExtra from 'fs-extra'

function tmpFile (suffix: string): string {
  return path.join(os.tmpdir(), suffix)
}

// TODO make this a user setting
const downloadFolder = path.join(os.homedir(), 'Downloads')

function downloadFilePath (suffix: string): string {
  return _findAvailableFilename(path.join(downloadFolder, suffix))
}

function exists (filepath: string): boolean {
  return fs.existsSync(filepath)
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

export {
  copy,
  downloadFilePath,
  exists,
  tmpFile,
}
