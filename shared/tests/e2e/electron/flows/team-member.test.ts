import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToTeams} from '@/tests/e2e/electron/helpers/navigate'
import {TEAMS_ROW, TEAMS_MEMBER_LIST, TEAMS_MEMBER_PAGE} from '@/tests/e2e/shared/test-ids'

test('team member page renders', async ({page}) => {
  const smokeUser = process.env['KB_SMOKE_USER']
  if (!smokeUser) {
    test.skip()
    return
  }
  await navigateToTeams(page)
  const rows = page.getByTestId(TEAMS_ROW)
  if ((await rows.count()) === 0) {
    test.skip()
    return
  }
  await rows.first().click()
  await expect(page.getByTestId(TEAMS_MEMBER_LIST).first()).toBeVisible({timeout: 5_000})
  // Click the smoke user's username in the member list
  await page.getByTestId(TEAMS_MEMBER_LIST).getByText(smokeUser, {exact: true}).first().click()
  await expect(page.getByTestId(TEAMS_MEMBER_PAGE).first()).toBeVisible({timeout: 5_000})
})
