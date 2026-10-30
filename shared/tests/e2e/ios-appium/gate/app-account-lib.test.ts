import {notSmokeProblem} from './app-account-lib'

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
