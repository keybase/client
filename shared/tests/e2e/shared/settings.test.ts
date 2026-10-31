import {newRunId} from '../accounts/run-id'
import {mainRpc} from './main-rpc'
import {
  deleteEmailIfPresent,
  emailSubscriptions,
  emails,
  requireStampedEmail,
  restoreContactSettings,
  restoreEmailSubscriptions,
  restoreEmojiAnimations,
  restoreGlobalNotifSettings,
  restoreUnfurlSettings,
  setLockdownMode,
  setPrimaryEmail,
  stampedEmail,
} from './settings'

jest.mock('./main-rpc', () => ({mainRpc: jest.fn()}))

const saved = {...process.env}
const run = newRunId()
const other = newRunId(Date.now() - 3_600_000)
beforeEach(() => {
  Object.assign(process.env, {KB_E2E_RUN_ID: run, KB_E2E_TEAM: 'testteam', KB_SECOND_USER: 'testuser-mac', KB_SMOKE_USER: 'testuser'})
  jest.mocked(mainRpc).mockReset()
})
afterEach(() => {
  process.env = {...saved}
})

const messageOf = async (f: () => unknown) => {
  try {
    await f()
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
  return undefined
}

// A main service holding `state`, answering the reads and taking the writes the settings helpers send.
type State = {
  contact: object
  emails: Array<{email: string; isPrimary: boolean}>
  gregor: Array<string>
  lockdown: boolean
  notif: Record<string, boolean>
  subs: {settings: Array<{description: string; name: string; subscribed: boolean}>; unsub: boolean}
  unfurl: {blocklist: Array<string>; mode: number; whitelist: Array<string>}
}
const fakeMain = (state: State) => {
  const writes: Array<string> = []
  jest.mocked(mainRpc).mockImplementation(async (method: string, arg: object) => {
    const a = arg as Record<string, unknown>
    const answer = (): unknown => {
      switch (method) {
        case 'keybase.1.emails.getEmails':
          return state.emails
        case 'keybase.1.emails.deleteEmail':
          state.emails = state.emails.filter(e => e.email !== a['email'])
          return null
        case 'keybase.1.emails.setPrimaryEmail':
          state.emails = state.emails.map(e => ({...e, isPrimary: e.email === a['email']}))
          return null
        case 'keybase.1.account.userGetContactSettings':
          return {...state.contact, version: 3}
        case 'keybase.1.account.userSetContactSettings':
          state.contact = a['settings'] as object
          return null
        case 'chat.1.local.getUnfurlSettings':
          return state.unfurl
        case 'chat.1.local.saveUnfurlSettings':
          state.unfurl = a as State['unfurl']
          return null
        case 'chat.1.local.getGlobalAppNotificationSettingsLocal':
          return {settings: state.notif}
        case 'chat.1.local.setGlobalAppNotificationSettingsLocal':
          state.notif = a['settings'] as Record<string, boolean>
          return null
        case 'keybase.1.apiserver.GetWithSession':
          return {body: JSON.stringify({notifications: {email: state.subs}})}
        case 'keybase.1.apiserver.PostJSON':
          for (const {key, value} of a['JSONPayload'] as Array<{key: string; value: string}>) {
            state.subs.settings = state.subs.settings.map(s => (`${s.name}|email` === key ? {...s, subscribed: value === '1'} : s))
          }
          return null
        case 'keybase.1.account.getLockdownMode':
          return {status: state.lockdown}
        case 'keybase.1.account.setLockdownMode':
          state.lockdown = !!a['enabled']
          return null
        case 'keybase.1.gregor.getState':
          return {items: state.gregor.map(category => ({item: {category}}))}
        case 'chat.1.local.toggleEmojiAnimations':
          state.gregor = a['enabled'] ? state.gregor.filter(c => c !== 'emojianimations') : [...state.gregor, 'emojianimations']
          return null
        default:
          throw new Error(`unexpected ${method}`)
      }
    }
    if (!/\.(user)?get/i.test(method)) writes.push(method)
    return Promise.resolve(answer() as never)
  })
  return writes
}

const initial = (): State => ({
  contact: {allowFolloweeDegrees: 1, allowGoodTeams: true, enabled: false, teams: null},
  emails: [{email: 'testuser@keybase.io', isPrimary: true}],
  gregor: [],
  lockdown: false,
  notif: {'1': true, '2': false},
  subs: {
    settings: [
      {description: 'a', name: 'one', subscribed: true},
      {description: 'b', name: 'two', subscribed: false},
    ],
    unsub: false,
  },
  unfurl: {blocklist: ['b.com', 'a.com'], mode: 2, whitelist: []},
})

describe('emails', () => {
  test("a stamped address is this run's example.com one; any other is refused naming none", async () => {
    expect(stampedEmail()).toBe(`e2e-${run}-mail@example.com`)
    expect(stampedEmail('two')).toBe(`e2e-${run}-two@example.com`)
    for (const addr of [`e2e-${other}-mail@example.com`, `e2e-${run}-mail@example.org`, 'testuser@keybase.io', `e2e-${run}-MAIL@example.com`, `e2e-${run}-@example.com`]) {
      const m = await messageOf(() => requireStampedEmail(addr))
      expect(m).toMatch(/^refusing /)
      for (const n of [run, other, 'testuser', 'keybase']) expect(m).not.toContain(n)
    }
    expect(await messageOf(async () => deleteEmailIfPresent('testuser@keybase.io'))).toMatch(/^refusing /)
    expect(jest.mocked(mainRpc)).not.toHaveBeenCalled()
  })

  test('the list is parse-anchored by its primary address', async () => {
    fakeMain({...initial(), emails: [{email: 'x@example.com', isPrimary: false}]})
    expect(await messageOf(emails)).toMatch(/primary/)
  })

  test('deleteEmailIfPresent deletes a listed stamped address and reads it gone; absent, it is a no-op', async () => {
    const state = initial()
    state.emails.push({email: stampedEmail(), isPrimary: false})
    const writes = fakeMain(state)
    await deleteEmailIfPresent(stampedEmail())
    await deleteEmailIfPresent(stampedEmail())
    expect(writes).toEqual(['keybase.1.emails.deleteEmail'])
    expect(state.emails.map(e => e.email)).toEqual(['testuser@keybase.io'])
  })

  test('deleteEmailIfPresent refuses the primary address: the original goes back first', async () => {
    const state = initial()
    state.emails = [{email: 'testuser@keybase.io', isPrimary: false}, {email: stampedEmail(), isPrimary: true}]
    const writes = fakeMain(state)
    expect(await messageOf(async () => deleteEmailIfPresent(stampedEmail()))).toMatch(/primary/)
    await setPrimaryEmail('testuser@keybase.io')
    await setPrimaryEmail('testuser@keybase.io')
    await deleteEmailIfPresent(stampedEmail())
    expect(writes).toEqual(['keybase.1.emails.setPrimaryEmail', 'keybase.1.emails.deleteEmail'])
  })

  test('setPrimaryEmail refuses an address the account does not list, naming none', async () => {
    const writes = fakeMain(initial())
    const m = await messageOf(async () => setPrimaryEmail('someone@else.com'))
    expect(m).toMatch(/^refusing /)
    expect(m).not.toContain('someone')
    expect(writes).toEqual([])
  })
})

describe('restores are no-ops when the settings already are the original', () => {
  test('every restore of an unchanged account sends nothing', async () => {
    const state = initial()
    const writes = fakeMain(state)
    await restoreContactSettings({allowFolloweeDegrees: 1, allowGoodTeams: true, enabled: false, teams: null})
    // the lists compare sorted
    await restoreUnfurlSettings({blocklist: ['a.com', 'b.com'], mode: 2, whitelist: []})
    await restoreGlobalNotifSettings({'1': true, '2': false})
    await restoreEmailSubscriptions((await emailSubscriptions()).map(({name, subscribed}) => ({name, subscribed})))
    await setLockdownMode(false)
    await restoreEmojiAnimations(true)
    expect(writes).toEqual([])
  })

  test('each restore of a changed account puts the original back and reads it back', async () => {
    const state = initial()
    const writes = fakeMain(state)
    const subs = (await emailSubscriptions()).map(({name, subscribed}) => ({name, subscribed}))
    Object.assign(state, {
      contact: {allowFolloweeDegrees: 1, allowGoodTeams: true, enabled: true, teams: null},
      gregor: ['emojianimations'],
      lockdown: true,
      notif: {'1': true},
      unfurl: {blocklist: [], mode: 0, whitelist: []},
    })
    state.subs.settings = state.subs.settings.map(s => ({...s, subscribed: !s.subscribed}))
    await restoreContactSettings({allowFolloweeDegrees: 1, allowGoodTeams: true, enabled: false, teams: null})
    await restoreUnfurlSettings({blocklist: ['a.com', 'b.com'], mode: 2, whitelist: []})
    await restoreGlobalNotifSettings({'1': true, '2': false})
    await restoreEmailSubscriptions(subs)
    await setLockdownMode(false)
    await restoreEmojiAnimations(true)
    expect(writes).toEqual([
      'keybase.1.account.userSetContactSettings',
      'chat.1.local.saveUnfurlSettings',
      'chat.1.local.setGlobalAppNotificationSettingsLocal',
      'keybase.1.apiserver.PostJSON',
      'keybase.1.account.setLockdownMode',
      'chat.1.local.toggleEmojiAnimations',
    ])
    expect(state.notif).toEqual({'1': true, '2': false})
    expect(state.subs.settings.map(s => s.subscribed)).toEqual([true, false])
  })
})

test('emailSubscriptions refuses an account unsubscribed from all email notifications', async () => {
  const state = initial()
  state.subs.unsub = true
  fakeMain(state)
  expect(await messageOf(emailSubscriptions)).toMatch(/^refusing /)
})
