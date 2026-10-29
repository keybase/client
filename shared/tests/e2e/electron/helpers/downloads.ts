// Files a flow has the app save to ~/Downloads, and their removal: only the exact file the test
// downloaded is ever deleted, never anything that was there before it.
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export const downloadsDir = path.join(os.homedir(), 'Downloads')

// ~/Downloads/<name>, which the test must not find there before it downloads: the app would save
// beside it under another name, and a file that is not the test's is never deleted.
export const freshDownloadPath = (name: string) => {
  if (name !== path.basename(name) || name.startsWith('.')) throw new Error(`not a plain file name: ${name}`)
  const p = path.join(downloadsDir, name)
  if (fs.existsSync(p)) throw new Error(`${p} is already there: move it away and run again (the test never overwrites or deletes it)`)
  return p
}

// Deletes the file this test downloaded, re-checking right before that it is still exactly that: a
// plain file (not a link) directly in ~/Downloads, of the size the test saw.
export const removeOwnDownload = (p: string, size: number) => {
  const st = fs.lstatSync(p)
  if (!st.isFile() || st.isSymbolicLink()) throw new Error(`refusing to delete ${p}: not a plain file`)
  if (fs.realpathSync(path.dirname(p)) !== fs.realpathSync(downloadsDir)) throw new Error(`refusing to delete ${p}: not in ${downloadsDir}`)
  if (st.size !== size) throw new Error(`refusing to delete ${p}: ${st.size} bytes, not the ${size} downloaded`)
  fs.unlinkSync(p)
}
