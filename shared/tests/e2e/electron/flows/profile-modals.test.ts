import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openOwnProfile, navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {snap} from '@/tests/e2e/electron/helpers/snap'

test('edit profile modal opens', async ({page}, testInfo) => {
  await openOwnProfile(page)
  await page.getByText('Edit profile', {exact: true}).click()
  const fullName = page.getByPlaceholder('Full name')
  await expect(fullName).toBeVisible({timeout: 5_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(fullName).not.toBeVisible({timeout: 5_000})
  await navigateToPeople(page)
})

test('proofs list modal opens', async ({page}, testInfo) => {
  await openOwnProfile(page)
  await page.getByText('Add more identities', {exact: true}).click()
  const filter = page.getByPlaceholder(/Search \d+ platforms/)
  await expect(filter).toBeVisible({timeout: 10_000})
  await snap(page, testInfo)
  await page.locator('.icon-gen-iconfont-close:visible').first().click()
  await expect(filter).not.toBeVisible({timeout: 5_000})
  await navigateToPeople(page)
})
