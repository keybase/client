import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openOwnProfile, navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'

test('edit profile modal opens', async ({page}, testInfo) => {
  await openOwnProfile(page)
  await step(page, testInfo, 'own profile')
  await page.getByText('Edit profile', {exact: true}).click()
  const fullName = page.getByPlaceholder('Full name')
  await expect(fullName).toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'edit profile modal', {card: true})
  await closeModal(page)
  await expect(fullName).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
  await navigateToPeople(page)
})

test('proofs list modal opens', async ({page}, testInfo) => {
  await openOwnProfile(page)
  await step(page, testInfo, 'own profile')
  await page.getByText('Add more identities', {exact: true}).click()
  const filter = page.getByPlaceholder(/Search \d+ platforms/)
  await expect(filter).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'proofs list modal', {card: true})
  await manualEdge(page, testInfo, 'external-proofs')
  await closeModal(page)
  await expect(filter).not.toBeVisible({timeout: 5_000})
  await step(page, testInfo, 'modal closed')
  await navigateToPeople(page)
})
