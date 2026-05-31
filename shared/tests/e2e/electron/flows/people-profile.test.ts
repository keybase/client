import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {PEOPLE_FEED, PROFILE_PAGE} from '@/tests/e2e/shared/test-ids'

test('people feed renders', async ({page}) => {
  await navigateToPeople(page)
  await expect(page.getByTestId(PEOPLE_FEED).first()).toBeVisible()
})

test('own profile page renders', async ({page}) => {
  const smokeUser = process.env['KB_SMOKE_USER']!
  await navigateToPeople(page)
  await page.click(`text=Hi ${smokeUser}!`)
  await page.click('text=View/Edit profile')
  await expect(page.getByTestId(PROFILE_PAGE).first()).toBeVisible({timeout: 10_000})
  // Close the account-switcher popup and return to a clean tab state
  await page.keyboard.press('Escape')
  await navigateToPeople(page)
})
