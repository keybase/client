import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, goBack, scrollDownToText, scrollToTestID} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
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

    await visit(async () => byText('Advanced').click(), T.SETTINGS_ADVANCED)
    await visit(async () => byText('Backup').click(), T.SETTINGS_ARCHIVE)
    // Chat/Files by row testID — their text collides with the bottom tab bar.
    // scrollToTestID first: on the tablet's short landscape LeftNav these rows
    // can sit below the fold (present but not displayed → a tap would no-op).
    await visit(async () => {
      await scrollToTestID(T.SETTINGS_ROW_CHAT)
      await el(T.SETTINGS_ROW_CHAT).click()
    }, T.SETTINGS_CHAT)
    await visit(async () => byText('Display').click(), T.SETTINGS_DISPLAY)
    await visit(async () => byText('Feedback').click(), T.SETTINGS_FEEDBACK)
    await visit(async () => {
      await scrollToTestID(T.SETTINGS_ROW_FILES)
      await el(T.SETTINGS_ROW_FILES).click()
    }, T.SETTINGS_FILES)
    await visit(async () => {
      await scrollDownToText('Notifications')
      await byText('Notifications').click()
    }, T.SETTINGS_NOTIFICATIONS)
    await visit(async () => {
      await scrollDownToText('About')
      await byText('About').click()
    }, T.SETTINGS_ABOUT)
  })
})
