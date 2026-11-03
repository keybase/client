// Reads what a log file gained since a mark, across the file being replaced or rotated aside. Pure
// file reads: helpers/lifecycle.ts reads the app's Go log through it, and launch.mts (which loads no
// wdio module) reads the just-launched app's.
import * as fs from 'fs'
import * as path from 'path'

// The file as it was at a mark: where it ended (a file not there yet ends at its start), and every log
// file of its folder then, by inode, so what the app wrote since is told from what it wrote before.
export type LogMark = {file: string; offset: number; ino: number; had: ReadonlyArray<number>}

const statOrUndefined = (file: string) => fs.statSync(file, {throwIfNoEntry: false})

const readFrom = (file: string, offset: number) => {
  const size = statOrUndefined(file)?.size ?? 0
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

// The log's files in its folder, in the order they were written: the ones rotated aside
// (<name>-<time stamp>) by name, then the file itself.
const logFiles = (file: string) => {
  const dir = path.dirname(file)
  const name = path.basename(file)
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(n => n.startsWith(`${name}-`))
    .sort()
    .concat(fs.existsSync(file) ? [name] : [])
    .map(n => path.join(dir, n))
}

// Where `file` ends now.
export const markFile = (file: string): LogMark => {
  const st = statOrUndefined(file)
  return {file, had: logFiles(file).flatMap(f => statOrUndefined(f)?.ino ?? []), ino: st?.ino ?? 0, offset: st?.size ?? 0}
}

// Whole lines written to the log since the mark, in order. The Go log is replaced by a new file when
// the app launches and rotated aside when it grows too big, any number of times: the marked file
// (found by inode wherever it is now) is read from the mark, every file that was not there at the
// mark from its start. A last line the app is still writing is left for a later read.
export const linesSince = (mark: LogMark): Array<string> => {
  const had = new Set(mark.had)
  const text = logFiles(mark.file).map(f => {
    const ino = statOrUndefined(f)?.ino
    const read = ino === undefined ? '' : ino === mark.ino ? readFrom(f, mark.offset) : had.has(ino) ? '' : readFrom(f, 0)
    return f === mark.file ? read.slice(0, read.lastIndexOf('\n') + 1) : read
  })
  return text.join('').split('\n').filter(Boolean)
}
