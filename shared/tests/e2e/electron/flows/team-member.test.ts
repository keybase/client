import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openE2ETeam} from '@/tests/e2e/electron/helpers/navigate'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {TEAMS_MEMBER_LIST, TEAMS_MEMBER_PAGE, TEAMS_TAB_MEMBERS_BUTTON} from '@/tests/e2e/shared/test-ids'

test('team member page renders', async ({page}) => {
  const {smokeUser} = loadE2EAccounts()
  await openE2ETeam(page)
  // the team page remembers its last tab: select Members
  await page.getByTestId(TEAMS_TAB_MEMBERS_BUTTON).locator('visible=true').first().click()
  await expect(page.getByTestId(TEAMS_MEMBER_LIST).first()).toBeVisible({timeout: 5_000})
  // Click the smoke user's username in the member list
  await page.getByTestId(TEAMS_MEMBER_LIST).getByText(smokeUser, {exact: true}).first().click()
  await expect(page.getByTestId(TEAMS_MEMBER_PAGE).first()).toBeVisible({timeout: 5_000})
})
