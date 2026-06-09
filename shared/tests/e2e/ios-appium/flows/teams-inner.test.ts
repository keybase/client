import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToTeams, goBack} from '../helpers/navigate'
import {el, els, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('teams inner', () => {
  it('explores team tabs when a team exists', async () => {
    await escapeToTabs()
    await navigateToTeams()

    // Maestro: runFlow when visible teams-row — legitimately-absent data guard
    if ((await els(T.TEAMS_ROW).length) === 0) return // account has no teams
    await els(T.TEAMS_ROW)[0]!.click()

    // Members tab is the default
    await waitForTestID(T.TEAMS_MEMBER_LIST, 5000)
    await expect(el(T.TEAMS_MEMBER_LIST)).toExist()

    // Settings tab — Maestro: tapOn text: "Settings"
    await byText('Settings').click()
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

    await goBack()
  })
})
