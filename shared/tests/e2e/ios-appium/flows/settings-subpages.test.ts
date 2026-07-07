import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, goBack, scrollToTestID, dismissKeyboard, tapSettingsRow} from '../helpers/navigate'
import {el, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('settings subpages', () => {
  // Open More once and visit each subpage (tap → assert → back). On phone this is
  // 16/16; on the tablet two-pane (landscape) the Files settings tab is flaky
  // under the full suite — see notes, tracked separately.
  it('renders each settings subpage', async () => {
    await escapeToTabs()
    await navigateToMore()
    await waitForTestID(T.SETTINGS_ACCOUNT, 3000)

    const visit = async (open: () => Promise<unknown>, marker: string) => {
      // A prior subpage (e.g. Feedback) raises the keyboard, which covers the
      // lower LeftNav rows on the tablet (they report displayed=false → taps
      // no-op). Dismiss it before tapping the next row.
      await dismissKeyboard()
      await open()
      await waitForTestID(marker, 5000)
      await expect(el(marker)).toExist()
      // Phone pushes a full-screen subpage (go back to the list); tablet keeps
      // the left nav visible (no back needed).
      if (!(await el(T.SETTINGS_ACCOUNT).isExisting())) {
        await goBack()
        await waitForTestID(T.SETTINGS_ACCOUNT, 4000)
      }
    }

    await visit(async () => tapSettingsRow('Advanced'), T.SETTINGS_ADVANCED)
    await visit(async () => tapSettingsRow('Backup'), T.SETTINGS_ARCHIVE)
    // Chat/Files by row testID — their text collides with the bottom tab bar.
    // scrollToTestID first: on the tablet's short landscape LeftNav these rows
    // can sit below the fold (present but not displayed → a tap would no-op).
    await visit(async () => {
      await scrollToTestID(T.SETTINGS_ROW_CHAT)
      await el(T.SETTINGS_ROW_CHAT).click()
    }, T.SETTINGS_CHAT)
    await visit(async () => tapSettingsRow('Display'), T.SETTINGS_DISPLAY)
    await visit(async () => tapSettingsRow('Feedback'), T.SETTINGS_FEEDBACK)
    await visit(async () => {
      await scrollToTestID(T.SETTINGS_ROW_FILES)
      await el(T.SETTINGS_ROW_FILES).click()
    }, T.SETTINGS_FILES)
    await visit(async () => tapSettingsRow('Notifications'), T.SETTINGS_NOTIFICATIONS)
    await visit(async () => tapSettingsRow('About'), T.SETTINGS_ABOUT)
  })
})
