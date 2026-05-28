import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToTeams} from '@/tests/e2e/electron/helpers/navigate'
import {TEAMS_LIST} from '@/tests/e2e/shared/test-ids'

test('teams tab renders', async ({page}) => {
  await navigateToTeams(page)
  await expect(page.getByTestId(TEAMS_LIST)).toBeVisible()
})
