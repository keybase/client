import {expect} from '@wdio/globals'
import {
  escapeToTabs,
  navigateToMore,
  navigateToChat,
  tapSettingsRow,
} from '../helpers/navigate'
import {byText, el, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

// Visual-coverage states. The harness screenshots AFTER each test and
// escapeToTabs resets before the next one, so each test ENDS at the state it
// wants captured (modal left open on purpose). View-only: nothing submits.

describe('visual states', () => {
  it('archive backup modal', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Backup')
    await waitForTestID(T.SETTINGS_ARCHIVE, 5000)
    await byText('Backup all chat').click()
    await byText('Share a copy of your content to another app').waitForExist({timeout: 5000})
    await expect(byText('Share a copy of your content to another app')).toExist()
  })

  it('wallet screen', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Wallet')
    await byText('Secret key').waitForExist({timeout: 8000})
    await expect(byText('Secret key')).toExist()
  })

  it('password screen', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Account')
    await byText('Email & phone').waitForExist({timeout: 5000})
    // mobile label is just "Change" (desktop says "Change password")
    const change = byText('Change')
    if (!(await change.isExisting())) {
      // randomPW accounts show "Set a password" instead
      await byText('Set a password').click()
    } else {
      await change.click()
    }
    // input placeholders aren't labels in the XCUITest tree — anchor on the checkbox
    await byText('Show typing').waitForExist({timeout: 5000})
    await expect(byText('Show typing')).toExist()
  })

  it('add device chooser', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Devices')
    await waitForTestID(T.DEVICES_LIST, 5000)
    await byText('Add a device or paper key').click()
    await byText('Protect your account by having more devices and paper keys.').waitForExist({
      timeout: 5000,
    })
    await expect(byText('Protect your account by having more devices and paper keys.')).toExist()
  })

  it('account switcher', async () => {
    await escapeToTabs()
    // Chat uses a full-width custom header on iPad, so exercise it here rather
    // than only checking a root that uses the navigator's standard header.
    await navigateToChat()
    await el(T.PEOPLE_HEADER_AVATAR).click()
    await byText('Log in as another user').waitForExist({timeout: 8000})
    await expect(byText('Log in as another user')).toExist()
  })
})
