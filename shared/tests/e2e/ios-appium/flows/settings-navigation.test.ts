import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('settings navigation', () => {
  it('renders settings and navigates to Account', async () => {
    await escapeToTabs()
    await navigateToMore()
    await waitForTestID(T.SETTINGS_ACCOUNT, 3000)
    await expect(el(T.SETTINGS_ACCOUNT)).toExist()

    // Maestro: tapOn text: "Account"
    await byText('Account').click()
    // Maestro: extendedWaitUntil visible text: "Email & phone"
    await byText('Email & phone').waitForExist({timeout: 3000, timeoutMsg: '"Email & phone" never appeared on Account page'})
    await expect(byText('Email & phone')).toExist()
  })
})
