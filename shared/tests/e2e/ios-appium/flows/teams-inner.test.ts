import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToTeams} from '../helpers/navigate'
import {byText, el, els, waitForTestID, tapForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('teams inner', () => {
  it('explores team tabs when a team exists', async () => {
    await escapeToTabs()
    await navigateToTeams()

    // Wait for real team rows to load before tapping (container renders first).
    await waitForTestID(T.TEAMS_ROW, 8000)
    await els(T.TEAMS_ROW)[0]!.click()

    // Explicitly select the Members tab by testID (the app remembers the
    // last-selected team tab; "Members" text also matches "N members").
    // tapForTestID: the tap follows the team-row push and is swallowed mid-
    // transition on slow sims, so retry until the member list appears.
    await tapForTestID(T.TEAMS_TAB_MEMBERS_BUTTON, T.TEAMS_MEMBER_LIST, {timeout: 10000})
    await expect(el(T.TEAMS_MEMBER_LIST)).toExist()

    // Settings tab is an icon-only gear on phone (no text), so tap by testID.
    await el(T.TEAMS_TAB_SETTINGS_BUTTON).click()
    await waitForTestID(T.TEAMS_SETTINGS_TAB, 3000)
    await expect(el(T.TEAMS_SETTINGS_TAB)).toExist()

    // Bots tab — Maestro: tapOn text: "Bots"
    await byText('Bots').click()
    await waitForTestID(T.TEAMS_BOTS_TAB, 3000)
    await expect(el(T.TEAMS_BOTS_TAB)).toExist()

    // Channels tab — only present for big teams or admins
    // Maestro: nested runFlow when visible text: "Channels"
    const channelsTab = byText('Channels')
    if (await channelsTab.isExisting()) {
      await channelsTab.click()
      await waitForTestID(T.TEAMS_CHANNEL_LIST, 3000)
      await expect(el(T.TEAMS_CHANNEL_LIST)).toExist()
    }
  })
})
