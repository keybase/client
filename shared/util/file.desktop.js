// @flow

import os from 'os'
import path from 'path'

function tmpFile (suffix: string): string {
  return path.join(os.tmpdir(), 'preview-' + suffix)
}

function downloadFilePath (suffix: string): string {
  return path.join(os.tmpdir(), suffix)
}

export {
  downloadFilePath,
  tmpFile,
}
