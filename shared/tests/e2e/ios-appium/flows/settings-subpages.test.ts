import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, goBack, scrollDownToText} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

async function openMore(): Promise<void> {
  await escapeToTabs()
  await navigateToMore()
  await waitForTestID(T.SETTINGS_ACCOUNT, 3000)
}

describe('settings subpages', () => {
  it('Advanced page renders', async () => {
    await openMore()
    await byText('Advanced').click()
    await waitForTestID(T.SETTINGS_ADVANCED, 3000)
    await expect(el(T.SETTINGS_ADVANCED)).toExist()
    await goBack()
  })

  it('Backup page renders', async () => {
    await openMore()
    await byText('Backup').click()
    await waitForTestID(T.SETTINGS_ARCHIVE, 3000)
    await expect(el(T.SETTINGS_ARCHIVE)).toExist()
    await goBack()
  })

  it('Chat page renders', async () => {
    await openMore()
    // Tap by row testID, not text: "Chat" collides with the bottom tab bar's Chat tab.
    await el(T.SETTINGS_ROW_CHAT).click()
    await waitForTestID(T.SETTINGS_CHAT, 3000)
    await expect(el(T.SETTINGS_CHAT)).toExist()
    await goBack()
  })

  it('Display page renders', async () => {
    await openMore()
    await byText('Display').click()
    await waitForTestID(T.SETTINGS_DISPLAY, 3000)
    await expect(el(T.SETTINGS_DISPLAY)).toExist()
    await goBack()
  })

  it('Feedback page renders', async () => {
    await openMore()
    await byText('Feedback').click()
    await waitForTestID(T.SETTINGS_FEEDBACK, 3000)
    await expect(el(T.SETTINGS_FEEDBACK)).toExist()
    await goBack()
  })

  it('Files page renders', async () => {
    await openMore()
    // Tap by row testID, not text: "Files" collides with the bottom tab bar's Files tab.
    await el(T.SETTINGS_ROW_FILES).click()
    await waitForTestID(T.SETTINGS_FILES, 3000)
    await expect(el(T.SETTINGS_FILES)).toExist()
    await goBack()
  })

  it('Notifications page renders', async () => {
    await openMore()
    await scrollDownToText('Notifications')
    await byText('Notifications').click()
    await waitForTestID(T.SETTINGS_NOTIFICATIONS, 3000)
    await expect(el(T.SETTINGS_NOTIFICATIONS)).toExist()
    await goBack()
  })

  it('About page renders', async () => {
    await openMore()
    await scrollDownToText('About')
    await byText('About').click()
    await waitForTestID(T.SETTINGS_ABOUT, 3000)
    await expect(el(T.SETTINGS_ABOUT)).toExist()
    await goBack()
  })
})
