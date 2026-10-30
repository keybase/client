import {evalInPage, inspectorPageFor} from '../../shared/metro-eval'
import {navigateToMore, navigateToPeople} from '../helpers/navigate'
import {loadE2EAccounts} from '../../accounts/env'
import {appAccount, asSecond, signedOutThenBack} from '../gate/accounts'
import {el} from '../helpers/elements'
import * as T from '../../shared/test-ids'
import {beginErrorCapture, takeErrors} from '../gate/errors'
import {step} from '../gate/step'

describe('harness helpers', () => {
  it('opens Settings by the tab bar and comes back', async () => {
    await navigateToMore()
    await step('Opened the Settings tab', {card: true})
    await navigateToPeople()
    await step('Back on the People tab')
  })

  it('collects the app console errors and clears them', async () => {
    const marker = `harness-helpers console.error ${Date.now()}`
    await beginErrorCapture()
    await evalInPage(await inspectorPageFor(process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest', 'keybase.ios'), `console.error(${JSON.stringify(marker)}); return null`)
    expect(await takeErrors()).toEqual([marker])
    expect(await takeErrors()).toEqual([])
  })

  it('runs a part as the second account and comes back to the smoke account', async () => {
    const {secondUser, smokeUser} = loadE2EAccounts()
    await asSecond(async () => {
      expect((await appAccount()).username).toBe(secondUser)
      await step('Signed in as the second account')
    })
    expect((await appAccount()).username).toBe(smokeUser)
  })

  it('shows the login list signed out and comes back to the smoke account', async () => {
    const {smokeUser} = loadE2EAccounts()
    await signedOutThenBack(async () => {
      await el(T.LOGIN_USER_LIST).waitForExist({timeout: 10_000})
      await step('The login screen lists the accounts')
    })
    expect(await appAccount()).toMatchObject({loggedIn: true, username: smokeUser})
  })
})
