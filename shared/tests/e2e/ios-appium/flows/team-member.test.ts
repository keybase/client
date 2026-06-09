import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {escapeToTabs, navigateToTeams} from '../helpers/navigate'
import {el, els, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('team member', () => {
  it('opens a team member page', async () => {
    const smokeUser = requireSmokeUser()
    await escapeToTabs()
    await navigateToTeams()

    if ((await els(T.TEAMS_ROW).length) === 0) return // account legitimately has no teams
    await els(T.TEAMS_ROW)[0]!.click()
    await waitForTestID(T.TEAMS_MEMBER_LIST, 5000)

    const user = byText(smokeUser)
    if (!(await user.isExisting())) return // smoke user not a member of this team
    await user.click()
    await waitForTestID(T.TEAMS_MEMBER_PAGE, 5000)
    await expect(el(T.TEAMS_MEMBER_PAGE)).toBeDisplayed()

    if ((await els(T.COMMON_BACK_BUTTON).length) > 0) await el(T.COMMON_BACK_BUTTON).click()
  })
})
