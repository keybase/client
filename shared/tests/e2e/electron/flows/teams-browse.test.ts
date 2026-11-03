import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToTeams, openE2ETeam} from '@/tests/e2e/electron/helpers/navigate'
import {TEAMS_LIST, TEAMS_ROW} from '@/tests/e2e/shared/test-ids'

test('teams list renders', async ({page}) => {
  await navigateToTeams(page)
  await expect(page.getByTestId(TEAMS_LIST).first()).toBeVisible()
})

test('can open the e2e team', async ({page}) => {
  await openE2ETeam(page)
  await expect(page.getByTestId(TEAMS_ROW).first()).not.toBeVisible({timeout: 3_000})
})
