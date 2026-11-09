import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {copyLogWindow} from './log-window'

const at = (iso: string) => Date.parse(iso)
const line = (iso: string, text: string) => `${iso} ▶ [DEBU keybase x.go:1] ${text}`

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-window-'))
})
afterEach(() => {
  fs.rmSync(dir, {force: true, recursive: true})
})

// A log file whose last write was at `mtime`, as the service leaves a rotated one.
const writeLog = (name: string, lines: Array<string>, mtime: string) => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, `${lines.join('\n')}\n`)
  fs.utimesSync(file, at(mtime) / 1000, at(mtime) / 1000)
  return file
}

test('copies the window across the rotated file and the current log, oldest first', async () => {
  writeLog('service.log-20261109T120000-0500-20261109T120100-0500', [line('2026-11-09T12:00:30.000000-05:00', 'too old')], '2026-11-09T12:01:00-05:00')
  writeLog(
    'service.log-20261109T120100-0500-20261109T120200-0500',
    [line('2026-11-09T12:01:10.000000-05:00', 'before'), line('2026-11-09T12:01:50.500000-05:00', 'rotated in window')],
    '2026-11-09T12:02:00-05:00'
  )
  const log = writeLog(
    'service.log',
    [
      line('2026-11-09T12:02:05.000000-05:00', 'current in window'),
      'goroutine 1 [running]:',
      line('2026-11-09T12:03:00.000000-05:00', 'after'),
      'a stack line after the window',
    ],
    '2026-11-09T12:03:00-05:00'
  )
  // a different log in the same directory is never read
  writeLog('kbfs.log', [line('2026-11-09T12:02:01.000000-05:00', 'kbfs')], '2026-11-09T12:03:00-05:00')

  const dest = path.join(dir, 'window.log')
  const got = await copyLogWindow(log, at('2026-11-09T12:01:30-05:00'), at('2026-11-09T12:02:30-05:00'), dest)

  expect(got.files.map(f => path.basename(f))).toEqual(['service.log-20261109T120100-0500-20261109T120200-0500', 'service.log'])
  expect(got.lines).toBe(3)
  expect(fs.readFileSync(dest, 'utf8')).toBe(
    [line('2026-11-09T12:01:50.500000-05:00', 'rotated in window'), line('2026-11-09T12:02:05.000000-05:00', 'current in window'), 'goroutine 1 [running]:', ''].join(
      '\n'
    )
  )
})

test('a missing log writes an empty window', async () => {
  const dest = path.join(dir, 'window.log')
  const got = await copyLogWindow(path.join(dir, 'missing', 'service.log'), 0, Date.now(), dest)
  expect(got).toEqual({files: [], lines: 0})
  expect(fs.readFileSync(dest, 'utf8')).toBe('')
})
