import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, goBack, scrollDownToText} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('settings subpages', () => {
  // One test that opens More once and visits each subpage (tap → assert → back),
  // rather than re-navigating to More for every subpage.
  it('renders each settings subpage', async () => {
    await escapeToTabs()
    await navigateToMore()
    await waitForTestID(T.SETTINGS_ACCOUNT, 3000)

    const visit = async (open: () => Promise<unknown>, marker: string) => {
      await open()
      await waitForTestID(marker, 4000)
      await expect(el(marker)).toExist()
      await goBack()
      await waitForTestID(T.SETTINGS_ACCOUNT, 4000) // back on the More/settings root
    }

    await visit(async () => byText('Advanced').click(), T.SETTINGS_ADVANCED)
    await visit(async () => byText('Backup').click(), T.SETTINGS_ARCHIVE)
    // Chat/Files by row testID — their text collides with the bottom tab bar.
    await visit(async () => el(T.SETTINGS_ROW_CHAT).click(), T.SETTINGS_CHAT)
    await visit(async () => byText('Display').click(), T.SETTINGS_DISPLAY)
    await visit(async () => byText('Feedback').click(), T.SETTINGS_FEEDBACK)
    await visit(async () => el(T.SETTINGS_ROW_FILES).click(), T.SETTINGS_FILES)
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
