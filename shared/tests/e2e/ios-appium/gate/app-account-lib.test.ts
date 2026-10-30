import {notSmokeProblem, settledAccount} from './app-account-lib'

describe('notSmokeProblem', () => {
  test('the app on the smoke account is fine', () => {
    expect(notSmokeProblem({loggedIn: true, switching: false, username: 'testuser'}, 'testuser')).toBeUndefined()
  })

  test('another account names the account switcher, never a command', () => {
    const p = notSmokeProblem({loggedIn: true, switching: false, username: 'testuser-mac'}, 'testuser')
    expect(p).toContain('signed in as testuser-mac')
    expect(p).toContain('switch the simulator app to testuser with its account switcher')
    expect(p).not.toContain('keybase login')
  })

  test('a signed out app refuses', () => {
    expect(notSmokeProblem({loggedIn: false, switching: false, username: ''}, 'testuser')).toContain('(nobody; signed out)')
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
