import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {setEnvVars} from '../../accounts/env'
import {envSecrets, scanAndPurge, watchEnvSecrets} from './secret-scan'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-'))
  fs.chmodSync(dir, 0o700)
})
afterEach(() => {
  fs.rmSync(dir, {force: true, recursive: true})
})

const first = 'e2e-firstfirstfirstfirstfirs'
const next = 'e2e-nextnextnextnextnextnext'
const noEnv = {} as NodeJS.ProcessEnv

const writeEnv = () => {
  const p = path.join(dir, 'env')
  const lines = [
    'export KB_SMOKE_USER=testuser',
    'export KB_SECOND_USER=testuser-mac',
    'export KB_E2E_TEAM=testteam',
    'export KB_SECOND_HOME=/x/second',
    "export KB_SECOND_PAPERKEY='alpha bravo charlie delta'",
    'export KB_OWNER_HOME=/x/owner',
    "export KB_OWNER_PAPERKEY='echo foxtrot golf hotel'",
    `export KB_SECOND_PASSWORD='${first}'`,
  ]
  fs.writeFileSync(p, lines.join('\n') + '\n', {mode: 0o600})
  return p
}

test('envSecrets includes a pending KB_SECOND_PASSWORD_NEXT', () => {
  const file = writeEnv()
  setEnvVars(file, {KB_SECOND_PASSWORD_NEXT: next})
  expect(envSecrets(file, noEnv)).toEqual(expect.arrayContaining([first, next, 'alpha bravo charlie delta', 'echo foxtrot golf hotel']))
})

test('a rotation mid-run leaves both passwords scanned for: the old one, the pending one, the promoted one', () => {
  const file = writeEnv()
  const watch = watchEnvSecrets(() => envSecrets(file, noEnv), 60_000)
  try {
    // rotateSecondPassword's two writes: the new value as _NEXT, then promoted with _NEXT dropped
    setEnvVars(file, {KB_SECOND_PASSWORD_NEXT: next})
    watch.sample()
    setEnvVars(file, {KB_SECOND_PASSWORD: next, KB_SECOND_PASSWORD_NEXT: null})
    expect(envSecrets(file, noEnv)).not.toContain(first)
    const secrets = watch.secrets()
    expect(secrets).toEqual(expect.arrayContaining([first, next]))

    const results = path.join(dir, 'results')
    fs.mkdirSync(results)
    fs.writeFileSync(path.join(results, 'early.md'), `- textbox "Password": ${first}\n`)
    fs.writeFileSync(path.join(results, 'clean.md'), '- textbox "Password"\n')
    const scan = scanAndPurge([results], secrets)
    expect(scan.hits).toEqual([path.join(results, 'early.md')])
    expect(fs.existsSync(path.join(results, 'early.md'))).toBe(false)
  } finally {
    watch.stop()
  }
})

test('the timer catches a value between samples, and a failed read later on is skipped', () => {
  jest.useFakeTimers()
  try {
    const values = [['a-password-one'], ['a-password-two']]
    let i = 0
    const watch = watchEnvSecrets(() => {
      const v = values[i]
      if (!v) throw new Error('unreadable')
      return v
    }, 100)
    i = 1
    jest.advanceTimersByTime(100)
    i = 2
    jest.advanceTimersByTime(100)
    i = 1
    expect(watch.secrets()).toEqual(['a-password-one', 'a-password-two'])
    watch.stop()
  } finally {
    jest.useRealTimers()
  }
})
