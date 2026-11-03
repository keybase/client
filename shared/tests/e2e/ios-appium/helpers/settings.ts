// Settings pages, reached from the More list.
import * as T from '../../shared/test-ids'
import {expectScreen} from '../gate/screens.ts'
import {el} from './elements'
import {escapeToTabs, navigateToMore, scrollToTestID, tapSettingsRow} from './navigate'

// The More list. Bound: escapeToTabs 30, the More tab 20 = 50.
export const openMore = async () => {
  await escapeToTabs()
  await navigateToMore()
}

// A settings page from the More list: its row tapped (the one with testID `rowTestID` when given,
// else the one labelled `row`), the `screen` route waited for and its `marker` testID drawn. Bound:
// openMore 50, the row (by testID: scrolled to 25 and tapped 1; by label: tapSettingsRow 55), the
// screen 11, its marker 10 = 126 (97 by testID).
export const openSettingsPage = async (row: string, screen: string, marker: string, rowTestID?: string) => {
  await openMore()
  if (rowTestID) {
    await scrollToTestID(rowTestID)
    await el(rowTestID).click()
  } else {
    await tapSettingsRow(row)
  }
  await expectScreen(`the ${row} settings`, screen)
  await el(marker).waitForExist({timeout: 10_000, timeoutMsg: `the ${row} settings page never drew`})
}

export const ACCOUNT_TAB = 'settingsTabs.accountTab'

// Settings > Account. Bound: openSettingsPage 126.
export const openAccountPage = async () => openSettingsPage('Account', ACCOUNT_TAB, T.SETTINGS_ACCOUNT_PAGE)
