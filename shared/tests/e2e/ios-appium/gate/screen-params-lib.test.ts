import {appSnapshotBody, stripSecretParams} from './screen-params-lib'

// the app's own predicate (engine/transport-shared.tsx isSecretParam) is tested with this lib there;
// this project does not compile app modules, so a stand-in names the same keys here
const isSecretParam = (key: string, v: unknown) =>
  ['paperkey', 'tokenorname'].includes(key.toLowerCase()) && typeof v !== 'boolean' && v !== undefined && v !== null

const link = 'https://keybase.io/i/t/abcdefghijklmnop#secretkey0123456789'

test("a join screen's inviteKey and secret-named params are dropped, the rest kept", () => {
  const params = {
    inviteDetails: {teamID: 'tid', teamName: {parts: ['team', 'sub']}},
    inviteKey: link,
    nested: [{paperKey: 'one two three', tokenOrName: link.toLowerCase(), username: 'testuser'}],
    storeSecret: true,
    teamID: 'tid',
  }
  const out = stripSecretParams(params, isSecretParam)
  expect(out).toEqual({
    inviteDetails: {teamID: 'tid', teamName: {parts: ['team', 'sub']}},
    nested: [{username: 'testuser'}],
    storeSecret: true,
    teamID: 'tid',
  })
  expect(JSON.stringify(out)).not.toMatch(/secretkey|keybase\.io|one two/)
  // the params themselves are left as they were
  expect(params.inviteKey).toBe(link)
})

test('the snapshot body strips the screen params inside the app', () => {
  const modules: Record<string, unknown> = {
    'constants/router.tsx': {getVisibleScreen: () => ({name: 'teamInviteLinkJoin', params: {inviteDetails: {teamID: 'tid'}, inviteKey: link}})},
    'engine/transport-shared.tsx': {isSecretParam},
    'stores/config.tsx': {useConfigState: {getState: () => ({httpSrv: {address: 'a', token: 't'}, loggedIn: true})}},
    'stores/shell.tsx': {useShellState: {getState: () => ({mobileAppState: 'active'})}},
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function('kbModule', appSnapshotBody) as (m: (name: string) => unknown) => {screen?: {name?: string; params?: unknown}}
  const snap = run(name => modules[name])
  expect(snap.screen).toEqual({name: 'teamInviteLinkJoin', params: {inviteDetails: {teamID: 'tid'}}})
  expect(JSON.stringify(snap)).not.toContain('secretkey')
})

test("a crypto output screen's input and output text stay in the app; its other params are kept", () => {
  const ciphertext = 'BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE. kiOUtMhcc4NXXRb XMxIeCbf5rCmoht. END'
  for (const name of ['encryptOutput', 'decryptOutput', 'signOutput', 'verifyOutput']) {
    const modules: Record<string, unknown> = {
      'constants/router.tsx': {
        getVisibleScreen: () => ({
          name,
          params: {input: 'e2e-run-crypto-1234', output: ciphertext, outputSenderUsername: 'testuser-mac', outputValid: true, recipients: ['testuser']},
        }),
      },
      'engine/transport-shared.tsx': {isSecretParam},
      'stores/config.tsx': {useConfigState: {getState: () => ({httpSrv: {address: 'a', token: 't'}, loggedIn: true})}},
      'stores/shell.tsx': {useShellState: {getState: () => ({mobileAppState: 'active'})}},
    }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function('kbModule', appSnapshotBody) as (m: (name: string) => unknown) => {screen?: {name?: string; params?: unknown}}
    const snap = run(n => modules[n])
    expect(snap.screen).toEqual({name, params: {outputSenderUsername: 'testuser-mac', outputValid: true, recipients: ['testuser']}})
    expect(JSON.stringify(snap)).not.toMatch(/SALTPACK|e2e-run-crypto/)
  }
})

test("another screen's input and output params are kept", () => {
  const modules: Record<string, unknown> = {
    'constants/router.tsx': {getVisibleScreen: () => ({name: 'encryptTab', params: {input: 'x', output: 'y'}})},
    'engine/transport-shared.tsx': {isSecretParam},
    'stores/config.tsx': {useConfigState: {getState: () => ({httpSrv: {address: 'a', token: 't'}, loggedIn: true})}},
    'stores/shell.tsx': {useShellState: {getState: () => ({mobileAppState: 'active'})}},
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = new Function('kbModule', appSnapshotBody) as (m: (name: string) => unknown) => {screen?: {params?: unknown}}
  expect(run(n => modules[n]).screen?.params).toEqual({input: 'x', output: 'y'})
})
