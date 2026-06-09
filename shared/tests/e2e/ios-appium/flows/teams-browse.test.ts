import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToTeams} from '../helpers/navigate'
import {el, els, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('teams browse', () => {
  it('renders the teams list and opens the first team', async () => {
    await escapeToTabs()
    await navigateToTeams()
    await expect(el(T.TEAMS_LIST)).toExist()

    // Wait for real team rows to load, then open the first.
    await waitForTestID(T.TEAMS_ROW, 8000)
    await els(T.TEAMS_ROW)[0]!.click()
    await byText('Members').waitForExist({timeout: 5000, timeoutMsg: '"Members" never appeared after opening team'})
    await expect(byText('Members')).toExist()
  })
})
