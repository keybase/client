import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {setEnvVars} from '../../accounts/env'
import {newRunId} from '../../accounts/run-id'
import {
  envSecrets,
  forgetRunInviteLinks,
  forgetStaleInviteLinks,
  inviteLinkSecrets,
  rememberInviteLink,
  runInviteLinkSecrets,
  scanAndPurge,
  SECRET_SCAN_FILE,
  unscannedProblem,
  watchEnvSecrets,
} from './secret-scan'

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

test('with armor, a file holding saltpack armor is a hit and is deleted; without, it is left', () => {
  const results = path.join(dir, 'results')
  fs.mkdirSync(path.join(results, 'ios-logs'), {recursive: true})
  const armored = path.join(results, 'ios-logs', 'flows.log')
  const clean = path.join(results, 'run.json')
  fs.writeFileSync(armored, 'step: BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiOUtMhcc4NXXRb XMxIeCbf5rCmoht.\n')
  fs.writeFileSync(clean, '{"output": "<saltpack message>"}\n')
  expect(scanAndPurge([results], [first]).hits).toEqual([])
  expect(fs.existsSync(armored)).toBe(true)
  const scan = scanAndPurge([results], [first], {armor: true})
  expect(scan.hits).toEqual([armored])
  expect(scan.line).not.toMatch(/SALTPACK/)
  expect(fs.existsSync(armored)).toBe(false)
  expect(fs.existsSync(clean)).toBe(true)
})

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

test("the scan keeps the value rotated away even when no sample fell between the change and the promotion", () => {
  const file = writeEnv()
  const watch = watchEnvSecrets(() => envSecrets(file, noEnv), 60_000)
  try {
    // the whole rotation between two samples: the scan's own read sees only the promoted value
    setEnvVars(file, {KB_SECOND_PASSWORD_NEXT: next})
    setEnvVars(file, {KB_SECOND_PASSWORD: next, KB_SECOND_PASSWORD_NEXT: null})
    const results = path.join(dir, 'results')
    fs.mkdirSync(results)
    fs.writeFileSync(path.join(results, 'metro.log'), `submitSecret ${first}\n`)
    expect(scanAndPurge([results], watch.secrets()).hits).toEqual([path.join(results, 'metro.log')])
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

test('a file named among the dirs is scanned, and a missing one is skipped', () => {
  const hit = path.join(dir, 'report.html')
  const clean = path.join(dir, 'census.md')
  fs.writeFileSync(hit, `<p>${first}</p>`)
  fs.writeFileSync(clean, 'nothing here')
  const scan = scanAndPurge([hit, clean, path.join(dir, 'missing.json')], [first])
  expect(scan.hits).toEqual([hit])
  expect(scan.scanned).toBe(2)
  expect(fs.existsSync(hit)).toBe(false)
  expect(fs.existsSync(clean)).toBe(true)
})

test('a report is built only from results whose run scan passed after they were written', () => {
  expect(unscannedProblem(dir)).toMatch(/never scanned/)
  fs.writeFileSync(path.join(dir, 'results.json'), '{}')
  fs.writeFileSync(path.join(dir, SECRET_SCAN_FILE), JSON.stringify({line: '1 file held a secret', ok: false}))
  expect(unscannedProblem(dir)).toBe("the flow run's secret scan failed (1 file held a secret)")
  fs.writeFileSync(path.join(dir, SECRET_SCAN_FILE), JSON.stringify({line: 'clean', ok: true}))
  expect(unscannedProblem(dir)).toBeUndefined()
  const later = new Date(Date.now() + 5_000)
  fs.utimesSync(path.join(dir, 'results.json'), later, later)
  expect(unscannedProblem(dir)).toMatch(/written after/)
})

// the shape the CLI prints: /i/t/<short id>#<key>
const link = 'https://keybase.io/i/t/AbCdEfGhIjKlMnOp#abcdefgh0123456789+xyz'
const key = 'abcdefgh0123456789+xyz'

test("a run's invite link is recorded mode 600, and its scan finds the link or its key in an artifact", () => {
  const file = path.join(dir, 'keybase-e2e', 'invite-links.json')
  const run = newRunId()
  rememberInviteLink(link, run, file, true)
  rememberInviteLink(link, run, file, true)
  expect(fs.statSync(file).mode & 0o777).toBe(0o600)
  expect(fs.statSync(path.dirname(file)).mode & 0o777).toBe(0o700)
  const secrets = runInviteLinkSecrets(run, file)
  expect(secrets).toEqual(expect.arrayContaining([link, link.toLowerCase(), key, encodeURIComponent(key)]))
  expect(runInviteLinkSecrets(newRunId(Date.now() - 60 * 60_000), file)).toEqual([])

  const results = path.join(dir, 'results')
  fs.mkdirSync(results)
  // the app lowercases what its join field is given; a log can hold the key alone
  fs.writeFileSync(path.join(results, 'metro.log'), `tokenOrName: ${link.toLowerCase()}\n`)
  fs.writeFileSync(path.join(results, 'route.json'), JSON.stringify({inviteKey: key}))
  fs.writeFileSync(path.join(results, 'clean.log'), 'tokenOrName: <redacted>\n')
  const scan = scanAndPurge([results], secrets)
  expect(scan.hits.sort()).toEqual([path.join(results, 'metro.log'), path.join(results, 'route.json')])
  expect(fs.existsSync(path.join(results, 'clean.log'))).toBe(true)

  // the run's scan deletes the record once it has read it
  forgetRunInviteLinks(run, file)
  expect(runInviteLinkSecrets(run, file)).toEqual([])
  expect(fs.existsSync(file)).toBe(false)
})

test("another run's link replaces the record, and the sweep deletes a record a run before it left", () => {
  const file = path.join(dir, 'keybase-e2e', 'invite-links.json')
  const now = Date.now()
  const dead = newRunId(now - 10 * 60_000)
  const current = newRunId(now)
  rememberInviteLink(link, dead, file, true)
  rememberInviteLink(`${link}2`, current, file, true)
  expect(runInviteLinkSecrets(dead, file)).toEqual([])
  forgetStaleInviteLinks(current, now, file)
  expect(fs.existsSync(file)).toBe(true)
  forgetRunInviteLinks(dead, file)
  expect(fs.existsSync(file)).toBe(true)
  fs.writeFileSync(file, JSON.stringify({links: [link], runId: dead}), {mode: 0o600})
  forgetStaleInviteLinks(current, now, file)
  expect(fs.existsSync(file)).toBe(false)
})

test('no invite link is recorded outside a scanning run, and a readable record is refused', () => {
  const file = path.join(dir, 'keybase-e2e', 'invite-links.json')
  rememberInviteLink(link, newRunId(), file, false)
  expect(fs.existsSync(file)).toBe(false)
  expect(() => rememberInviteLink(link, 'nope00', file, true)).toThrow(/no valid run id/)
  expect(fs.existsSync(file)).toBe(false)

  const run = newRunId()
  rememberInviteLink(link, run, file, true)
  fs.chmodSync(file, 0o644)
  expect(() => runInviteLinkSecrets(run, file)).toThrow(/mode 644/)
  let message = ''
  try {
    rememberInviteLink(link, run, file, true)
  } catch (e) {
    message = e instanceof Error ? e.message : ''
  }
  expect(message).toMatch(/mode 644/)
  expect(message).not.toContain(key)
})

test("an invite link's scan values leave out what is too short to match", () => {
  expect(inviteLinkSecrets('no-key-here')).toEqual(['no-key-here'])
  expect(inviteLinkSecrets('https://keybase.io/i/t/abc#short')).toEqual(['https://keybase.io/i/t/abc#short'])
})
