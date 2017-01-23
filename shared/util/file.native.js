// @flow

// TODO
function tmpFile (suffix: string): string {
  throw new Error('Unimplemented')
}

function downloadFilePath (suffix: string): string {
  throw new Error('Unimplemented')
}

function copy (from: string, to: string) {
  throw new Error('Unimplemented')
}

function exists (from: string, to: string): boolean {
  // TODO implement
  return false
}

export {
  copy,
  exists,
  downloadFilePath,
  tmpFile,
}
