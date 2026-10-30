import {
  answerTo,
  CONFIGURED_ACCOUNTS_READ_BODY,
  configuredAccountsAskBody,
  LOGIN_SCREEN_BODY,
  notSmokeProblem,
  passwordScreenProblem,
  phoneDeviceProblem,
  settledAccount,
  storedSecretIn,
} from './app-account-lib'

describe('notSmokeProblem', () => {
  const accounts = {secondUser: 'testuser-mac', smokeUser: 'testuser'}

  test('the app on the smoke account is fine', () => {
    expect(notSmokeProblem({loggedIn: true, switching: false, username: 'testuser'}, accounts)).toBeUndefined()
  })

  test('the second account names the account switcher and no account name', () => {
    const p = notSmokeProblem({loggedIn: true, switching: false, username: 'testuser-mac'}, accounts)
    expect(p).toContain('signed in as <second>')
    expect(p).toContain('switch the simulator app to KB_SMOKE_USER with its account switcher')
    expect(p).not.toContain('keybase login')
    expect(p).not.toContain('testuser')
  })

  test('any other account is not named either', () => {
    const p = notSmokeProblem({loggedIn: true, switching: false, username: 'someone-else'}, accounts)
    expect(p).toContain('neither KB_SMOKE_USER nor KB_SECOND_USER')
    expect(p).not.toContain('someone-else')
    expect(p).not.toContain('testuser')
  })

  test('a signed out app refuses', () => {
    expect(notSmokeProblem({loggedIn: false, switching: false, username: ''}, accounts)).toContain('signed in as nobody,')
  })
})

describe('settledAccount', () => {
  const smoke = {loggedIn: true, switching: false, username: 'testuser'}
  const starting = {loggedIn: false, switching: false, username: ''}

  test('a signed-in answer settles at once', () => {
    expect(settledAccount(smoke, 1_000, 1_000, 60_000)).toEqual(smoke)
  })

  test('the signed-out answer of a runtime that just started is waited on', () => {
    expect(settledAccount(starting, 1_000, 1_000, 60_000)).toBeUndefined()
    expect(settledAccount(starting, 1_000, 60_999, 60_000)).toBeUndefined()
  })

  test('a signed-out answer that held for the settle time is believed', () => {
    expect(settledAccount(starting, 1_000, 61_000, 60_000)).toEqual(starting)
  })

  test('logged in with no username yet is still starting', () => {
    expect(settledAccount({loggedIn: true, switching: false, username: ''}, 1_000, 2_000, 60_000)).toBeUndefined()
  })

  test('an account switch is waited on, however long', () => {
    expect(settledAccount({...smoke, switching: true}, 1_000, 1_000_000, 60_000)).toBeUndefined()
  })
})

describe('phoneDeviceProblem', () => {
  const on = {deviceID: 'd'.repeat(32), deviceName: 'iOS Device1234', loggedIn: true, switching: false, username: 'testuser'}
  test("the smoke account's device is fine", () => {
    expect(phoneDeviceProblem(on, 'testuser')).toBeUndefined()
  })
  test('another account, a signed-out or switching app, or no device id is refused', () => {
    expect(phoneDeviceProblem({...on, username: 'testuser-mac'}, 'testuser')).toContain('testuser-mac')
    expect(phoneDeviceProblem({...on, loggedIn: false}, 'testuser')).toContain('signed out')
    expect(phoneDeviceProblem({...on, switching: true}, 'testuser')).toContain('switching')
    expect(phoneDeviceProblem({...on, deviceID: ''}, 'testuser')).toBe('the app names no device for the smoke account')
    expect(phoneDeviceProblem({...on, deviceName: ''}, 'testuser')).toBe('the app names no device for the smoke account')
  })
})

describe('storedSecretIn', () => {
  const listed = (accounts: Array<{hasStoredSecret: boolean; username: string}>) => ({accounts, ask: 'a1', state: 'listed' as const})

  test("an account's stored secret, either way", () => {
    const r = listed([
      {hasStoredSecret: true, username: 'testuser'},
      {hasStoredSecret: false, username: 'testuser-mac'},
    ])
    expect(storedSecretIn(r, 'testuser')).toBe(true)
    expect(storedSecretIn(r, 'testuser-mac')).toBe(false)
  })

  test('an account listed never or twice answers why', () => {
    expect(storedSecretIn(listed([]), 'testuser')).toBe('the phone lists testuser among its configured accounts 0 times, not once')
    const twice = listed([
      {hasStoredSecret: true, username: 'testuser'},
      {hasStoredSecret: true, username: 'testuser'},
    ])
    expect(storedSecretIn(twice, 'testuser')).toBe('the phone lists testuser among its configured accounts 2 times, not once')
  })

  test('a failed answer is no stored secret either way', () => {
    expect(storedSecretIn({ask: 'a1', error: 'boom', state: 'failed'}, 'testuser')).toBe("listing the phone's configured accounts failed: boom")
  })
})

describe('answerTo', () => {
  test("only the ask's own answer counts", () => {
    const done = {accounts: [], ask: 'a2', state: 'listed' as const}
    expect(answerTo(done, 'a2')).toBe(done)
    expect(answerTo(done, 'a3')).toBeUndefined()
    expect(answerTo({ask: 'a2', state: 'pending'}, 'a2')).toBeUndefined()
  })
})

describe('passwordScreenProblem', () => {
  const shown = {error: '', needPassword: true, selectedUser: 'testuser-mac', state: 'shown' as const}

  test('the screen asking for the account password is fine', () => {
    expect(passwordScreenProblem(shown, 'testuser-mac')).toBeUndefined()
  })

  test('a screen that would sign in another account refuses', () => {
    expect(passwordScreenProblem({...shown, selectedUser: 'testuser'}, 'testuser-mac')).toBe('the login screen would sign in testuser, not testuser-mac')
    expect(passwordScreenProblem({...shown, selectedUser: ''}, 'testuser-mac')).toBe('the login screen would sign in (nobody), not testuser-mac')
  })

  test('a screen asking no password, or none or two screens, refuses', () => {
    expect(passwordScreenProblem({...shown, needPassword: false}, 'testuser-mac')).toBe('the login screen asks no password for testuser-mac')
    expect(passwordScreenProblem({state: 'none'}, 'testuser-mac')).toBe('the login screen is not shown')
    expect(passwordScreenProblem({state: 'many'}, 'testuser-mac')).toBe('more than one login screen is mounted')
  })
})

describe('the account eval bodies', () => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = (body: string, kbModule?: unknown) => (new Function('kbModule', body) as (k: unknown) => unknown)(kbModule)

  test("an ask leaves the service's answer, each account's name and stored secret only, and a late earlier answer never replaces a newer ask's", async () => {
    const g = globalThis as unknown as {__kbE2EConfiguredAccounts?: unknown}
    const answers: Array<(list: unknown) => void> = []
    const kbModule = () => ({loginGetConfiguredAccountsRpcPromise: async () => new Promise(resolve => answers.push(resolve))})
    const tick = async () => new Promise(resolve => setTimeout(resolve, 0))
    try {
      expect(run(CONFIGURED_ACCOUNTS_READ_BODY)).toEqual({ask: '', state: 'pending'})
      expect(run(configuredAccountsAskBody('a1'), kbModule)).toBe(true)
      expect(run(configuredAccountsAskBody('a2'), kbModule)).toBe(true)
      expect(run(CONFIGURED_ACCOUNTS_READ_BODY)).toEqual({ask: 'a2', state: 'pending'})
      answers[1]?.([{fullname: 'Test User', hasStoredSecret: true, isCurrent: true, uid: 'u1', username: 'testuser'}])
      await tick()
      const newer = {accounts: [{hasStoredSecret: true, username: 'testuser'}], ask: 'a2', state: 'listed'}
      expect(run(CONFIGURED_ACCOUNTS_READ_BODY)).toEqual(newer)
      answers[0]?.([{fullname: 'Test User', hasStoredSecret: false, isCurrent: true, uid: 'u1', username: 'testuser'}])
      await tick()
      expect(run(CONFIGURED_ACCOUNTS_READ_BODY)).toEqual(newer)
    } finally {
      delete g.__kbE2EConfiguredAccounts
    }
  })

  test('the login screen read returns the selected account, its error and whether it needs a password, never the password', () => {
    const fiber = (props: Record<string, unknown>, child?: object) => ({child, memoizedProps: props, tag: 0})
    const screen = fiber({
      error: 'Incorrect password.',
      needPassword: true,
      password: 'not-a-password',
      selectedUser: 'testuser-mac',
      selectedUserChange: () => {},
    })
    const hook = {getFiberRoots: () => [{current: fiber({}, screen)}], renderers: new Map([[1, {}]])}
    const g = globalThis as unknown as {__REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown}
    g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook
    try {
      expect(run(LOGIN_SCREEN_BODY)).toEqual({error: 'Incorrect password.', needPassword: true, selectedUser: 'testuser-mac', state: 'shown'})
    } finally {
      delete g.__REACT_DEVTOOLS_GLOBAL_HOOK__
    }
  })
})
