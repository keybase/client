import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {readRunErrors} from './attempt'
import {heldSecretDirs, holdRunSecret, scanHeldSecrets} from './run-secrets'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-secrets-'))
  process.env['KB_IOS_REPORT_DIR'] = dir
})
afterEach(() => {
  delete process.env['KB_IOS_REPORT_DIR']
  fs.rmSync(dir, {force: true, recursive: true})
})

test('a held secret is looked for in what the run wrote: a file that holds it is deleted and a run error names the count', () => {
  const leak = path.join(dir, 'attempts', 'one.json')
  const clean = path.join(dir, 'attempts', 'two.json')
  fs.mkdirSync(path.dirname(leak), {recursive: true})
  fs.writeFileSync(leak, 'error: phrase alpha bravo charlie delta')
  fs.writeFileSync(clean, 'nothing here')
  expect(scanHeldSecrets([dir])).toEqual([])
  expect(fs.existsSync(leak)).toBe(true)
  holdRunSecret('')
  holdRunSecret('alpha bravo charlie delta')
  expect(scanHeldSecrets([dir])).toEqual([leak])
  expect(fs.existsSync(leak)).toBe(false)
  expect(fs.existsSync(clean)).toBe(true)
  expect(readRunErrors()).toEqual([expect.stringMatching(/deleted 1 file\(s\) that held a one-time secret/)])
})

test("the held secrets are looked for in the report, the release's child logs and the render root", () => {
  delete process.env['KB_VISUAL_RESULTS']
  const results = path.resolve(__dirname, '../../../results')
  expect(heldSecretDirs()).toEqual([dir, path.join(results, 'ios-logs'), path.join(results, 'visual', 'render')])
  process.env['KB_VISUAL_RESULTS'] = '/elsewhere/visual'
  try {
    expect(heldSecretDirs()).toEqual([dir, path.join(results, 'ios-logs'), '/elsewhere/visual/render'])
  } finally {
    delete process.env['KB_VISUAL_RESULTS']
  }
})
