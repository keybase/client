import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToTeams} from '../helpers/navigate'
import {el, els, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('teams browse', () => {
  it('renders the teams list', async () => {
    await escapeToTabs()
    await navigateToTeams()
    await expect(el(T.TEAMS_LIST)).toExist()
  })

  it('opens first team if one exists', async () => {
    await escapeToTabs()
    await navigateToTeams()

    // Maestro: runFlow when visible teams-row — legitimately-absent data guard
    if ((await els(T.TEAMS_ROW).length) === 0) return // account has no teams
    await els(T.TEAMS_ROW)[0]!.click()
    // Maestro: extendedWaitUntil visible text: "Members"
    await byText('Members').waitForExist({timeout: 3000, timeoutMsg: '"Members" tab never appeared after opening team'})
    await expect(byText('Members')).toExist()

    await el(T.COMMON_BACK_BUTTON).click()
  })
})
