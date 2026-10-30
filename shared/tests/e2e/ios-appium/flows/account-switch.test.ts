import {loadE2EAccounts} from '../../accounts/env'
import * as T from '../../shared/test-ids'
import {appAccount, asSecond, signedOutThenBack, signInFromStoredSecret} from '../gate/accounts'
import {loginScreen, rowShows, storedSecretOf} from '../gate/sign-in'
import {step} from '../gate/step'
import {openAccountSwitcher} from '../helpers/chat'
import {el} from '../helpers/elements'
import {escapeToTabs} from '../helpers/navigate'

// Switching accounts through the account switcher, and signing out to the login list and back in
// from a stored secret. No password is typed and no stored secret is dropped: "Log in as another
// user" signs out keeping both. No retry, as the account files never retry.
describe('account switch', function () {
  this.retries(0)

  it('switches to the second account and back through the account switcher', async function () {
    // worst case, from the helpers' bounds (s): switcher 60 (escapeToTabs 30 + its own 20 + a tab
    // 10), two row reads 20, escapeToTabs 30; in asSecond a switch 150 (switcher 60, the switch 60,
    // escapeToTabs 30), switcher 60, three row reads 30, escapeToTabs 30, and its restore 275
    // (settling 60 + a sign-in from the login list 215) = 655
    this.timeout(700_000)
    const {secondUser, smokeUser} = loadE2EAccounts()
    await openAccountSwitcher()
    // the row's text is read at all (its name), so not showing "Signed out" means something
    expect(await rowShows(T.ACCOUNT_SWITCHER_ROW_PREFIX + secondUser, secondUser)).toBe(true)
    expect(await rowShows(T.ACCOUNT_SWITCHER_ROW_PREFIX + secondUser, 'Signed out')).toBe(false)
    await step('The account switcher lists the second account, signed in')
    await escapeToTabs()

    await asSecond(async () => {
      expect(await appAccount()).toMatchObject({loggedIn: true, switching: false, username: secondUser})
      await openAccountSwitcher()
      // the account the app is on is the switcher's card, not one of its rows
      await el(T.ACCOUNT_SWITCHER_ROW_PREFIX + smokeUser).waitForExist({timeout: 10_000, timeoutMsg: 'the switcher has no row for the smoke account'})
      expect(await el(T.ACCOUNT_SWITCHER_ROW_PREFIX + secondUser).isExisting()).toBe(false)
      expect(await rowShows(T.ACCOUNT_SWITCHER_ROW_PREFIX + smokeUser, smokeUser)).toBe(true)
      expect(await rowShows(T.ACCOUNT_SWITCHER_ROW_PREFIX + smokeUser, 'Signed out')).toBe(false)
      await step('On the second account, the switcher offers the smoke account', {card: true})
      await escapeToTabs()
    })
    expect(await appAccount()).toMatchObject({loggedIn: true, switching: false, username: smokeUser})
    await step('Back on the smoke account')
  })

  it('signs out to the login list and signs the smoke account in from its stored secret, with no password', async function () {
    // worst case (s): switcher 60, login list 60, four row reads 40, two configured-account reads 40,
    // a sign-in from the row 85, escapeToTabs 30, and a restore 275 = 590
    this.timeout(600_000)
    const {secondUser, smokeUser} = loadE2EAccounts()
    await signedOutThenBack(async () => {
      expect(await appAccount()).toMatchObject({loggedIn: false})
      expect(await rowShows(T.LOGIN_USER_ROW_PREFIX + smokeUser, 'Signed in')).toBe(true)
      expect(await rowShows(T.LOGIN_USER_ROW_PREFIX + secondUser, 'Signed in')).toBe(true)
      expect(await storedSecretOf(smokeUser)).toBe(true)
      expect(await storedSecretOf(secondUser)).toBe(true)
      // the account that signed out is the one selected, and its stored secret needs no password
      expect(await loginScreen()).toMatchObject({needPassword: false, selectedUser: smokeUser, state: 'shown'})
      expect(await el(T.LOGIN_PASSWORD_INPUT).isExisting()).toBe(false)
      await step('Signed out, the login list shows both accounts signed in and asks no password')

      await signInFromStoredSecret(smokeUser)
      await escapeToTabs()
      expect(await appAccount()).toMatchObject({loggedIn: true, switching: false, username: smokeUser})
      await step('The smoke account signed in from its row, with no password', {card: true})
    })
    expect(await appAccount()).toMatchObject({loggedIn: true, switching: false, username: smokeUser})
  })
})
