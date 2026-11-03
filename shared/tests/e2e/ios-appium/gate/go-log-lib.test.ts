import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {linesSince, markFile} from './go-log-lib'

let dir = ''
let log = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-log-lib-'))
  log = path.join(dir, 'ios.log')
})
afterEach(() => fs.rmSync(dir, {force: true, recursive: true}))

test('reads only what the log gained since the mark', () => {
  fs.writeFileSync(log, 'old 1\nold 2\n')
  const mark = markFile(log)
  expect(linesSince(mark)).toEqual([])
  fs.appendFileSync(log, 'new 1\nnew 2\n')
  expect(linesSince(mark)).toEqual(['new 1', 'new 2'])
})

test('a log rotated aside is read to its end, then the new file from its start', () => {
  fs.writeFileSync(log, 'old 1\n')
  const mark = markFile(log)
  fs.appendFileSync(log, 'before rotate\n')
  fs.renameSync(log, path.join(dir, 'ios.log-20261103T010203'))
  fs.writeFileSync(log, 'after rotate\n')
  expect(linesSince(mark)).toEqual(['before rotate', 'after rotate'])
})

test('a log that was not there at the mark is read from its start, and one replaced and gone is read as the new file', () => {
  const none = markFile(log)
  fs.writeFileSync(log, 'first\n')
  expect(linesSince(none)).toEqual(['first'])
  const mark = markFile(log)
  fs.rmSync(log)
  fs.writeFileSync(log, 'relaunched\n')
  expect(linesSince(mark)).toEqual(['relaunched'])
})
