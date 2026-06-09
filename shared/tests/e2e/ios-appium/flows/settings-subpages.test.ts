import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore} from '../helpers/navigate'
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
    await el(T.COMMON_BACK_BUTTON).click()
  })

  it('Backup page renders', async () => {
    await openMore()
    await byText('Backup').click()
    await waitForTestID(T.SETTINGS_ARCHIVE, 3000)
    await expect(el(T.SETTINGS_ARCHIVE)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()
  })

  it('Chat page renders', async () => {
    await openMore()
    // Maestro: tapOn text: "Chat" — taps the Chat settings item (not the tab bar Chat)
    await byText('Chat').click()
    await waitForTestID(T.SETTINGS_CHAT, 3000)
    await expect(el(T.SETTINGS_CHAT)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()
  })

  it('Display page renders', async () => {
    await openMore()
    await byText('Display').click()
    await waitForTestID(T.SETTINGS_DISPLAY, 3000)
    await expect(el(T.SETTINGS_DISPLAY)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()
  })

  it('Feedback page renders', async () => {
    await openMore()
    await byText('Feedback').click()
    await waitForTestID(T.SETTINGS_FEEDBACK, 3000)
    await expect(el(T.SETTINGS_FEEDBACK)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()
  })

  it('Files page renders', async () => {
    await openMore()
    // Maestro: tapOn text: "Files" — taps the Files settings item (not the tab bar Files)
    await byText('Files').click()
    await waitForTestID(T.SETTINGS_FILES, 3000)
    await expect(el(T.SETTINGS_FILES)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()
  })

  it('Notifications page renders', async () => {
    await openMore()
    // Maestro: scrollUntilVisible then tapOn text: "Notifications"
    await byText('Notifications').scrollIntoView()
    await byText('Notifications').click()
    await waitForTestID(T.SETTINGS_NOTIFICATIONS, 3000)
    await expect(el(T.SETTINGS_NOTIFICATIONS)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()
  })

  it('About page renders', async () => {
    await openMore()
    // Maestro: scrollUntilVisible then tapOn text: "About"
    await byText('About').scrollIntoView()
    await byText('About').click()
    await waitForTestID(T.SETTINGS_ABOUT, 3000)
    await expect(el(T.SETTINGS_ABOUT)).toExist()
    await el(T.COMMON_BACK_BUTTON).click()
  })
})
