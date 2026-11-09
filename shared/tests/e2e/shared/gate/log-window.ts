// The lines a Go log wrote between two times, copied out of the log and the files it rotated into.
// The service rotates its log by size and keeps only the last couple of files, which under the e2e
// flows covers a few minutes: by the end of a run the lines from a failure early in it are gone, so
// they are copied while the failure is still recent.
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// A Go log line begins with its time: 2026-11-09T13:04:55.813989-05:00 ▶ [DEBU keybase ...
const stamp = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d))\s/

// The log and its rotated files (`<log>-<start>-<end>`) that were still being written at or after
// `from`, oldest first: a rotated file is last written when it is rotated out.
const filesSince = (log: string, from: number) => {
  const dir = path.dirname(log)
  const base = path.basename(log)
  let names: Array<string>
  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }
  return names
    .filter(n => n === base || n.startsWith(`${base}-`))
    .map(n => {
      const file = path.join(dir, n)
      try {
        return {file, mtimeMs: fs.statSync(file).mtimeMs}
      } catch {
        // rotated away between the listing and the stat
        return undefined
      }
    })
    .filter((f): f is {file: string; mtimeMs: number} => !!f && f.mtimeMs >= from)
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .map(f => f.file)
}

export type LogWindow = {files: Array<string>; lines: number}

// Copies into `dest` every line `log` wrote from `from` to `to` (ms since the epoch). A line with no
// time of its own (a panic's stack, a multi-line message) goes with the line before it.
export const copyLogWindow = async (log: string, from: number, to: number, dest: string): Promise<LogWindow> => {
  const files = filesSince(log, from)
  const out = fs.createWriteStream(dest)
  let lines = 0
  try {
    for (const file of files) {
      let keep = false
      const input = fs.createReadStream(file)
      const rl = readline.createInterface({crlfDelay: Infinity, input})
      try {
        for await (const line of rl) {
          const m = stamp.exec(line)
          if (m) {
            const t = Date.parse(m[1]!)
            if (t > to) break
            keep = t >= from
          }
          if (keep) {
            lines++
            if (!out.write(`${line}\n`)) await new Promise(resolve => out.once('drain', resolve))
          }
        }
      } catch {
        // a rotated file removed before it could be opened: the others still count
      } finally {
        rl.close()
        input.destroy()
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => out.end((e?: Error | null) => (e ? reject(e) : resolve())))
  }
  return {files, lines}
}
