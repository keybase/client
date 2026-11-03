// Reads what a log file gained since a mark, across the file being replaced or rotated aside. Pure
// file reads: helpers/lifecycle.ts reads the app's Go log through it, and launch.mts (which loads no
// wdio module) reads the just-launched app's.
import * as fs from 'fs'
import * as path from 'path'

export type LogMark = {file: string; offset: number; ino: number}

const statOrUndefined = (file: string) => fs.statSync(file, {throwIfNoEntry: false})

const readFrom = (file: string, offset: number) => {
  const size = fs.statSync(file).size
  if (size <= offset) return ''
  const fd = fs.openSync(file, 'r')
  try {
    const buf = Buffer.alloc(size - offset)
    fs.readSync(fd, buf, 0, buf.length, offset)
    return buf.toString('utf8')
  } finally {
    fs.closeSync(fd)
  }
}

// The Go service log inside an app data container.
export const goLogIn = (container: string) => path.join(container, 'Library/Caches/Keybase/logs/ios.log')

// Where `file` ends now (a file not there yet ends at its start).
export const markFile = (file: string): LogMark => {
  const st = statOrUndefined(file)
  return {file, ino: st?.ino ?? 0, offset: st?.size ?? 0}
}

// Lines written to the file since the mark. The Go log is replaced by a new file when the app
// launches and rotated aside when it grows too big, so when the file at the path is no longer
// the marked one, the rest of the marked file (found by inode, if still there) is read first,
// then the new file from its start.
export const linesSince = (mark: LogMark): Array<string> => {
  const st = statOrUndefined(mark.file)
  if (!st) return []
  let text: string
  if (st.ino === mark.ino) {
    text = readFrom(mark.file, mark.offset)
  } else {
    const dir = path.dirname(mark.file)
    const moved = fs
      .readdirSync(dir)
      .map(n => path.join(dir, n))
      .find(p => statOrUndefined(p)?.ino === mark.ino)
    text = (moved ? readFrom(moved, mark.offset) : '') + readFrom(mark.file, 0)
  }
  return text.split('\n').filter(Boolean)
}
