// @flow

import * as Types from '../../constants/types/fs'

const patchedExtToFileViewTypes = {
  // not exist in mime-db
  '.go': 'text',
  '.py': 'text',
  '.zsh': 'text',
  '.fish': 'text',
  '.cs': 'text',
  '.rb': 'text',
  '.m': 'text',
  '.mm': 'text',
  '.swift': 'text',
  '.flow': 'text',

  // exist in mime-db but have application/...
  '.php': 'text',
  '.pl': 'text',
  '.sh': 'text',
  '.js': 'text',
  '.json': 'text',
  '.sql': 'text',
  '.rs': 'text',
  '.xml': 'text',
  '.tex': 'text',
}

export const lookupPatchedExt = (name: string): ?Types.FileViewType => {
  const dot = name.lastIndexOf('.')
  if (dot === -1) {
    return null
  }
  return patchedExtToFileViewTypes[name.slice(dot)] || null
}
