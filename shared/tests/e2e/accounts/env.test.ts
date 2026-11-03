import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {childEnvVars, loadE2EAccounts, loadE2EEnv, parseEnvText, requireSecondPassword, setEnvVars} from './env'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-env-'))
  fs.chmodSync(dir, 0o700)
})
afterEach(() => {
  fs.rmSync(dir, {force: true, recursive: true})
})

const writeEnv = (text: string, mode = 0o600) => {
  const p = path.join(dir, 'env')
  fs.writeFileSync(p, text, {mode})
  fs.chmodSync(p, mode)
  return p
}

const noEnv = {} as NodeJS.ProcessEnv

const fullFile = [
  'export KB_SMOKE_USER=testuser',
  'export KB_SECOND_USER=testuser-mac',
  'export KB_E2E_TEAM=testteam',
  'export KB_SECOND_HOME=/x/second',
  "export KB_SECOND_PAPERKEY='alpha bravo charlie'",
  'export KB_OWNER_HOME="/x/owner home"',
  "export KB_OWNER_PAPERKEY='delta echo foxtrot'",
  '',
].join('\n')

test('lists every missing var together', () => {
  const p = writeEnv('export KB_SMOKE_USER=testuser\n')
  let message = ''
  try {
    loadE2EEnv(p, noEnv)
  } catch (e) {
    message = String(e)
  }
  for (const v of [
    'KB_SECOND_USER',
    'KB_E2E_TEAM',
    'KB_SECOND_HOME',
    'KB_SECOND_PAPERKEY',
    'KB_OWNER_HOME',
    'KB_OWNER_PAPERKEY',
  ]) {
    expect(message).toContain(v)
  }
  expect(message).not.toContain('KB_SMOKE_USER')
})

test('parses quoted values with spaces and maps peers', () => {
  const env = loadE2EEnv(writeEnv(fullFile), noEnv)
  expect(env.smokeUser).toBe('testuser')
  expect(env.team).toBe('testteam')
  expect(env.peers.second).toEqual({home: '/x/second', paperKey: 'alpha bravo charlie', user: 'testuser-mac'})
  expect(env.peers.owner).toEqual({home: '/x/owner home', paperKey: 'delta echo foxtrot', user: 'testuser'})
})

test('the environment overrides the file', () => {
  const env = loadE2EEnv(writeEnv(fullFile), {...noEnv, KB_E2E_TEAM: 'otherteam', KB_OWNER_HOME: '/y/owner'})
  expect(env.team).toBe('otherteam')
  expect(env.peers.owner.home).toBe('/y/owner')
})

test('refuses a file that is not mode 600', () => {
  const p = writeEnv(fullFile, 0o644)
  expect(() => loadE2EEnv(p, noEnv)).toThrow(/644/)
})

test('refuses a file whose directory is not mode 700', () => {
  const p = writeEnv(fullFile)
  fs.chmodSync(dir, 0o755)
  expect(() => loadE2EEnv(p, noEnv)).toThrow(/755.*700/)
  expect(() => loadE2EAccounts(p, noEnv)).toThrow(/755.*700/)
})

test('loadE2EAccounts needs only the account names and takes the environment over the file', () => {
  const p = writeEnv('export KB_SMOKE_USER=testuser\nexport KB_SECOND_USER=testuser-mac\nexport KB_E2E_TEAM=testteam\n')
  expect(loadE2EAccounts(p, noEnv)).toEqual({secondUser: 'testuser-mac', smokeUser: 'testuser', team: 'testteam'})
  expect(loadE2EAccounts(p, {...noEnv, KB_E2E_TEAM: 'otherteam'}).team).toBe('otherteam')
  // the same precedence as loadE2EEnv
  expect(loadE2EEnv(writeEnv(fullFile), {...noEnv, KB_E2E_TEAM: 'otherteam'}).team).toBe('otherteam')
  expect(() => loadE2EAccounts(writeEnv('export KB_SMOKE_USER=testuser\n'), noEnv)).toThrow(/KB_SECOND_USER, KB_E2E_TEAM/)
})

test('childEnvVars hands children the account names and service log, never a paper key or home', () => {
  const env = loadE2EEnv(writeEnv(fullFile), noEnv)
  expect(childEnvVars(env)).toEqual({KB_E2E_TEAM: 'testteam', KB_SECOND_USER: 'testuser-mac', KB_SMOKE_USER: 'testuser'})
  const withLog = loadE2EEnv(writeEnv(`${fullFile}export KB_E2E_SERVICE_LOG=/x/service.log\n`), noEnv)
  expect(childEnvVars(withLog)).toEqual({
    KB_E2E_SERVICE_LOG: '/x/service.log',
    KB_E2E_TEAM: 'testteam',
    KB_SECOND_USER: 'testuser-mac',
    KB_SMOKE_USER: 'testuser',
  })
  expect(JSON.stringify(childEnvVars(withLog))).not.toMatch(/alpha|delta|\/x\/second|owner home/)
})

test('lines are parsed, never executed', () => {
  expect(parseEnvText('export A=$(touch /tmp/nope)\n# export B=1\nC=plain # note\n')).toEqual({
    A: '$(touch',
    C: 'plain',
  })
})

test('setEnvVars replaces existing lines, appends new ones and keeps mode 600', () => {
  const p = writeEnv('export KB_SMOKE_USER=testuser\nexport KB_SECOND_HOME=/old\n')
  setEnvVars(p, {KB_OWNER_PAPERKEY: 'golf hotel', KB_SECOND_HOME: '/new'})
  expect(fs.readFileSync(p, 'utf8')).toBe(
    "export KB_SMOKE_USER=testuser\nexport KB_SECOND_HOME='/new'\nexport KB_OWNER_PAPERKEY='golf hotel'\n"
  )
  expect(fs.statSync(p).mode & 0o777).toBe(0o600)
})

test('setEnvVars removes a line whose update is null', () => {
  const p = writeEnv("export KB_SMOKE_USER=testuser\nexport KB_SECOND_PASSWORD_NEXT='x'\nexport KB_E2E_TEAM=testteam\n")
  setEnvVars(p, {KB_SECOND_PASSWORD: 'y', KB_SECOND_PASSWORD_NEXT: null})
  expect(fs.readFileSync(p, 'utf8')).toBe("export KB_SMOKE_USER=testuser\nexport KB_E2E_TEAM=testteam\nexport KB_SECOND_PASSWORD='y'\n")
})

test('secondPassword comes from KB_SECOND_PASSWORD and is optional', () => {
  expect(loadE2EEnv(writeEnv(fullFile), noEnv).secondPassword).toBeUndefined()
  expect(loadE2EEnv(writeEnv(`${fullFile}export KB_SECOND_PASSWORD='e2e-abc'\n`), noEnv).secondPassword).toBe('e2e-abc')
})

test('requireSecondPassword names the variable and the command that sets it, never a value', () => {
  expect(() => requireSecondPassword(loadE2EEnv(writeEnv(fullFile), noEnv))).toThrow(
    /KB_SECOND_PASSWORD.*yarn test:e2e:accounts:second-password/
  )
  expect(requireSecondPassword(loadE2EEnv(writeEnv(`${fullFile}export KB_SECOND_PASSWORD='e2e-abc'\n`), noEnv))).toBe('e2e-abc')
})

test('requireSecondPassword refuses while KB_SECOND_PASSWORD_NEXT is set, naming neither value', () => {
  const env = loadE2EEnv(writeEnv(`${fullFile}export KB_SECOND_PASSWORD='e2e-abc'\nexport KB_SECOND_PASSWORD_NEXT='e2e-def'\n`), noEnv)
  expect(env.secondPasswordChangePending).toBe(true)
  let message = ''
  try {
    requireSecondPassword(env)
  } catch (e) {
    message = e instanceof Error ? e.message : String(e)
  }
  expect(message).toMatch(/KB_SECOND_PASSWORD_NEXT.*stopped part way/)
  expect(message).not.toMatch(/e2e-abc|e2e-def/)
})
