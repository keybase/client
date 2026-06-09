import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {escapeToTabs, navigateToTeams, scrollDownToText} from '../helpers/navigate'
import {el, els, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('team member', () => {
  it('opens a team member page', async () => {
    const smokeUser = requireSmokeUser()
    await escapeToTabs()
    await navigateToTeams()

    // Wait for real team rows to load before tapping (the list container renders
    // before its data, so tapping too early misses / doesn't navigate).
    await waitForTestID(T.TEAMS_ROW, 8000)
    await els(T.TEAMS_ROW)[0]!.click()
    // The app remembers the last-selected tab per team, so explicitly select
    // the Members tab (by testID — "Members" text also matches "N members").
    await el(T.TEAMS_TAB_MEMBERS_BUTTON).click()
    await waitForTestID(T.TEAMS_MEMBER_LIST, 10000)

    // Scroll the member list until the smoke user shows — the list loads lazily
    // (slow under the full suite) and the user may be below the fold; scrolling
    // both waits for and reveals/renders the row.
    await scrollDownToText(smokeUser)
    const user = byText(smokeUser)
    await user.click()
    await waitForTestID(T.TEAMS_MEMBER_PAGE, 5000)
    // toExist (presence), not toBeDisplayed: the member-page container is a flex
    // Box2 that XCUITest reports visible="false" even when on screen.
    await expect(el(T.TEAMS_MEMBER_PAGE)).toExist()
  })
})
