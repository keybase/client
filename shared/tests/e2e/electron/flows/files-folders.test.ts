import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToFiles} from '@/tests/e2e/electron/helpers/navigate'
import {FILES_TLF_ROW, NAV_TAB_FILES} from '@/tests/e2e/shared/test-ids'

test('files browser shows top-level folders', async ({page}) => {
  await navigateToFiles(page)
  await expect(page.getByText('private', {exact: true}).first()).toBeVisible()
  await expect(page.getByText('public', {exact: true}).first()).toBeVisible()
  await expect(page.getByText('team', {exact: true}).first()).toBeVisible()
})

test('files browser has three TLF type rows', async ({page}) => {
  await navigateToFiles(page)
  const rows = page.getByTestId(FILES_TLF_ROW)
  await expect(rows.first()).toBeVisible()
  await expect(rows).toHaveCount(3)
})

test('can navigate into private folder', async ({page}) => {
  await navigateToFiles(page)
  await page.getByTestId(FILES_TLF_ROW).filter({hasText: 'private'}).click()
  await expect(page.getByRole('textbox', {name: 'Filter (⌘F)'})).toBeVisible()
})

test('can navigate into public folder', async ({page}) => {
  await navigateToFiles(page)
  await page.getByTestId(FILES_TLF_ROW).filter({hasText: 'public'}).click()
  await expect(page.getByRole('textbox', {name: 'Filter (⌘F)'})).toBeVisible()
})

test('can navigate into team folder', async ({page}) => {
  await navigateToFiles(page)
  await page.getByTestId(FILES_TLF_ROW).filter({hasText: 'team'}).click()
  await expect(page.getByRole('textbox', {name: 'Filter (⌘F)'})).toBeVisible()
})

test('can navigate back to files root', async ({page}) => {
  await navigateToFiles(page)
  await page.getByTestId(FILES_TLF_ROW).filter({hasText: 'private'}).click()
  await expect(page.getByRole('textbox', {name: 'Filter (⌘F)'})).toBeVisible()
  // Clicking the Files tab again when already on Files pops back to root
  await page.getByTestId(NAV_TAB_FILES).click()
  await expect(page.getByTestId(FILES_TLF_ROW)).toHaveCount(3)
})
