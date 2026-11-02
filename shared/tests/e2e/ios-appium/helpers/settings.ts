// Settings pages, reached from the More list.
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
// openMore 50, the row scrolled to 25 and tapped 1, the screen 11, its marker 10 = 97.
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
