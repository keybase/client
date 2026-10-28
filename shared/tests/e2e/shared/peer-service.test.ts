import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type {E2EEnv} from '../accounts/env'
import {
  deviceNameCandidates,
  ensurePeer,
  fileSecretStoreKey,
  peerConfigPath,
  peerUsesFileSecretStore,
  redactSecrets,
  setPeerFileSecretStore,
} from './peer-service'

let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'peer-svc-'))
  setPeerFileSecretStore(dir)
})
afterEach(() => {
  fs.rmSync(dir, {force: true, recursive: true})
})

const envWith = (home: string): E2EEnv => ({
  peers: {
    owner: {home: path.join(home, 'owner'), paperKey: 'x', user: 'testuser'},
    second: {home, paperKey: 'x', user: 'testuser-mac'},
  },
  secondUser: 'testuser-mac',
  smokeUser: 'testuser',
  team: 'testteam',
})

test('rejects a peer signed in as someone else, naming role, home and user', async () => {
  const start = jest.fn()
  await expect(
    ensurePeer('second', envWith(dir), {answers: async () => Promise.resolve(true), cli: async () => Promise.resolve('testuser-other'), start})
  ).rejects.toThrow(`peer second at ${dir} is signed in as testuser-other`)
  expect(start).not.toHaveBeenCalled()
})

test('with no socket and a start that never answers, rejects within the deadline naming the home', async () => {
  const start = jest.fn()
  const began = Date.now()
  await expect(
    ensurePeer('second', envWith(dir), {cli: async () => Promise.resolve('testuser-mac'), pollMs: 20, start, startDeadlineMs: 200})
  ).rejects.toThrow(`peer second at ${dir} is not running`)
  expect(Date.now() - began).toBeLessThan(2000)
  expect(start).toHaveBeenCalledTimes(1)
})

test('a call on a peer that died since names it as not running', async () => {
  let alive = true
  const peer = await ensurePeer('second', envWith(dir), {
    answers: async () => Promise.resolve(alive),
    cli: async args =>
      args[0] === 'whoami'
        ? Promise.resolve('testuser-mac')
        : Promise.reject(new Error('keybase chat api: connection refused')),
    start: jest.fn(),
  })
  alive = false
  await expect(peer.chatApi({method: 'list'})).rejects.toThrow(`peer second at ${dir} is not running`)
})

test('a call on a peer that signed out since names who it is now', async () => {
  let who = 'testuser-mac'
  const peer = await ensurePeer('second', envWith(dir), {
    answers: async () => Promise.resolve(true),
    cli: async args =>
      args[0] === 'whoami' ? Promise.resolve(who) : Promise.reject(new Error('keybase chat api: not logged in')),
    start: jest.fn(),
  })
  who = ''
  await expect(peer.chatApi({method: 'list'})).rejects.toThrow(`peer second at ${dir} is signed in as nobody`)
})

test('device name candidates start with e2e-<role>-svc', () => {
  const names = deviceNameCandidates('owner')
  expect(names[0]).toBe('e2e-owner-svc')
  expect(names[1]).toBe('e2e-owner-svc-2')
  expect(new Set(names).size).toBe(names.length)
})

test('redacts runs of ten or more lowercase words', () => {
  const key = 'one two three four five six seven eight nine ten eleven'
  expect(redactSecrets(`login failed: ${key}\nnine short words are kept here a b c`)).toBe(
    'login failed: <redacted>\nnine short words are kept here a b c'
  )
})

test('ensurePeer refuses a home whose config does not force the file secret store, naming the home', async () => {
  fs.writeFileSync(peerConfigPath(dir), JSON.stringify({current_user: 'testuser-mac'}))
  const start = jest.fn()
  await expect(
    ensurePeer('second', envWith(dir), {answers: async () => Promise.resolve(true), cli: async () => Promise.resolve('testuser-mac'), start})
  ).rejects.toThrow(`peer second at ${dir} does not keep its secret in a file`)
  expect(start).not.toHaveBeenCalled()
})

test('setPeerFileSecretStore keeps the existing config and never edits the main home', () => {
  fs.writeFileSync(peerConfigPath(dir), JSON.stringify({current_user: 'testuser-mac', users: {}}))
  expect(peerUsesFileSecretStore(dir)).toBe(false)
  setPeerFileSecretStore(dir)
  expect(JSON.parse(fs.readFileSync(peerConfigPath(dir), 'utf8'))).toEqual({
    current_user: 'testuser-mac',
    [fileSecretStoreKey]: true,
    users: {},
  })
  expect(peerUsesFileSecretStore(dir)).toBe(true)
  expect(() => setPeerFileSecretStore(os.homedir())).toThrow(/main service/)
})
