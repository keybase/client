import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToTeams} from '@/tests/e2e/electron/helpers/navigate'
import {TEAMS_LIST, TEAMS_ROW} from '@/tests/e2e/shared/test-ids'

test('teams list renders', async ({page}) => {
  await navigateToTeams(page)
  await expect(page.getByTestId(TEAMS_LIST).first()).toBeVisible()
})

test('can open a team if one exists', async ({page}) => {
  await navigateToTeams(page)
  const rows = page.getByTestId(TEAMS_ROW)
  const count = await rows.count()
  if (count === 0) {
    test.skip()
    return
  }
  await rows.first().click()
  await expect(page.getByTestId(TEAMS_ROW).first()).not.toBeVisible({timeout: 3_000})
})
