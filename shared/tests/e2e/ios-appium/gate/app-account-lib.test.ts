import {notSmokeProblem, settledAccount} from './app-account-lib'

describe('notSmokeProblem', () => {
  const accounts = {secondUser: 'testuser-mac', smokeUser: 'testuser'}

  test('the app on the smoke account is fine', () => {
    expect(notSmokeProblem({loggedIn: true, switching: false, username: 'testuser'}, accounts)).toBeUndefined()
  })

  test('the second account names the account switcher and no account name', () => {
    const p = notSmokeProblem({loggedIn: true, switching: false, username: 'testuser-mac'}, accounts)
    expect(p).toContain('signed in as KB_SECOND_USER')
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
    expect(notSmokeProblem({loggedIn: false, switching: false, username: ''}, accounts)).toContain('(nobody; signed out)')
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
