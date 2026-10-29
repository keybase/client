import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToPeople, openOwnProfile} from '@/tests/e2e/electron/helpers/navigate'
import {PEOPLE_FEED, PROFILE_PAGE} from '@/tests/e2e/shared/test-ids'

test('people feed renders', async ({page}) => {
  await navigateToPeople(page)
  await expect(page.getByTestId(PEOPLE_FEED).first()).toBeVisible()
})

test('own profile page renders', async ({page}) => {
  await openOwnProfile(page)
  await expect(page.getByTestId(PROFILE_PAGE).first()).toBeVisible({timeout: 10_000})
  await navigateToPeople(page)
})
