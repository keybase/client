import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type {E2EEnv} from '../../accounts/env'
import {rotateSecondPassword} from '../../accounts/second-password-lib'
import {iosRotateDeps, PHONE_PENDING_NOTE, requirePhoneSecondPassword, requireRotatable, type PhoneSides} from './password'

// jest's global (this project's types are mocha's and wdio's)
declare const jest: {mock: (path: string, factory: () => unknown) => void}

// the live sides drive the phone; these tests hand in fakes, so the modules are never loaded
jest.mock('./accounts', () => ({}))
jest.mock('./sign-in', () => ({}))
jest.mock('../../shared/peer-service', () => ({}))

const env: E2EEnv = {
  peers: {
    owner: {home: '/x/owner', paperKey: 'p', user: 'testuser'},
    second: {home: '/x/second', paperKey: 'p', user: 'testuser-mac'},
  },
  secondPassword: 'e2e-oldoldoldoldoldoldoldold',
  secondUser: 'testuser-mac',
  smokeUser: 'testuser',
  team: 'testteam',
}

let dir = ''
let envFile = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ios-password-'))
  fs.chmodSync(dir, 0o700)
  envFile = path.join(dir, 'env')
  fs.writeFileSync(envFile, "export KB_SECOND_PASSWORD='e2e-oldoldoldoldoldoldoldold'\n", {mode: 0o600})
})
afterEach(() => {
  fs.rmSync(dir, {force: true, recursive: true})
})

type Fakes = {
  peerCurrent?: boolean
  serverKeys?: boolean
  storedOnce?: Array<boolean>
}

// Sides that log each call, in order, the passwords they are handed as "<pw>".
const sides = (f: Fakes = {}) => {
  const log: Array<string> = []
  const stored = [...(f.storedOnce ?? [true])]
  const s: PhoneSides = {
    peerHasServerKeys: async () => {
      log.push('peer hasServerKeys')
      return Promise.resolve(!!f.serverKeys)
    },
    peerPasswordIsCurrent: async (_e, pw) => {
      log.push(`peer passphraseCheck ${pw ? '<pw>' : ''}`)
      return Promise.resolve(f.peerCurrent ?? true)
    },
    phoneRepair: async pw => {
      log.push(`phone repair ${pw ? '<pw>' : ''}`)
      stored.push(true)
      return Promise.resolve()
    },
    phoneStoredSecret: async user => {
      log.push(`phone stored secret ${user === 'testuser-mac' ? 'second' : user}`)
      return Promise.resolve(stored.shift() ?? true)
    },
    phoneSwitchToSecondAndBack: async () => {
      log.push('phone switch')
      return Promise.resolve()
    },
    say: () => {},
  }
  return {log, sides: s}
}

const changed = async (next: string) => {
  if (!next.startsWith('e2e-')) throw new Error('no new password')
  return Promise.resolve()
}

describe('iosRotateDeps', () => {
  test('checks the peer, then the phone, never the host, and promotes the new password', async () => {
    const {log, sides: s} = sides()
    const next = await rotateSecondPassword(env, changed, iosRotateDeps(s, envFile))
    expect(log).toEqual(['peer passphraseCheck <pw>', 'phone stored secret second', 'phone switch'])
    expect(fs.readFileSync(envFile, 'utf8')).toContain(`KB_SECOND_PASSWORD='${next}'`)
    expect(fs.readFileSync(envFile, 'utf8')).not.toContain('KB_SECOND_PASSWORD_NEXT')
  })

  test("a phone that lost its stored secret is repaired on the phone only, then checked again", async () => {
    const {log, sides: s} = sides({storedOnce: [false]})
    await rotateSecondPassword(env, changed, iosRotateDeps(s, envFile))
    expect(log).toEqual([
      'peer passphraseCheck <pw>',
      'phone stored secret second',
      'phone repair <pw>',
      'peer passphraseCheck <pw>',
      'phone stored secret second',
      'phone switch',
    ])
  })

  test('a peer that does not take the new password is not repaired either', async () => {
    const {log, sides: s} = sides({peerCurrent: false})
    const err = await rotateSecondPassword(env, changed, iosRotateDeps(s, envFile)).catch((e: unknown) => e as Error)
    expect(log).toEqual(['peer passphraseCheck <pw>'])
    expect(String(err)).toMatch(/peer/)
  })
})

describe('requireRotatable', () => {
  test('passes with nothing pending and no server-synced key', async () => {
    const {log, sides: s} = sides()
    await requireRotatable(env, s, envFile)
    expect(log).toEqual(['peer hasServerKeys'])
  })

  test('refuses a KB_SECOND_PASSWORD_NEXT pending in the env or the file, before asking the peer', async () => {
    const {log, sides: s} = sides()
    await expect(requireRotatable({...env, secondPasswordChangePending: true}, s, envFile)).rejects.toThrow(/KB_SECOND_PASSWORD_NEXT/)
    fs.appendFileSync(envFile, "export KB_SECOND_PASSWORD_NEXT='e2e-pendingpendingpendingpe'\n")
    await expect(requireRotatable(env, s, envFile)).rejects.toThrow(/KB_SECOND_PASSWORD_NEXT/)
    expect(log).toEqual([])
  })

  test('a pending change is refused with the phone note, and no password is handed out', async () => {
    const {sides: s} = sides()
    await expect(requireRotatable({...env, secondPasswordChangePending: true}, s, envFile)).rejects.toThrow(PHONE_PENDING_NOTE)
    expect(() => requirePhoneSecondPassword({...env, secondPassword: 'pw', secondPasswordChangePending: true}, envFile)).toThrow(PHONE_PENDING_NOTE)
    expect(requirePhoneSecondPassword({...env, secondPassword: 'pw'}, envFile)).toBe('pw')
    fs.appendFileSync(envFile, "export KB_SECOND_PASSWORD_NEXT='e2e-pendingpendingpendingpe'\n")
    expect(() => requirePhoneSecondPassword({...env, secondPassword: 'pw'}, envFile)).toThrow(PHONE_PENDING_NOTE)
  })

  test('refuses an account with a server-synced PGP key', async () => {
    const {sides: s} = sides({serverKeys: true})
    await expect(requireRotatable(env, s, envFile)).rejects.toThrow(/server-synced/)
  })
})
