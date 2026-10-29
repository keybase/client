// Settings > Files: the low-space warning threshold, read first and put back after.
import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {expectPersists} from '@/tests/e2e/electron/helpers/persisted'
import {step} from '@/tests/e2e/electron/helpers/step'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

const threshold = async () =>
  (await mainRpc<{spaceAvailableNotificationThreshold: number}>('keybase.1.SimpleFS.simpleFSSettings', {})).spaceAvailableNotificationThreshold

const gb = 1024 ** 3

const filesSettings = (page: Page) => page.getByTestId(T.SETTINGS_FILES).locator('visible=true')

const openFilesSettings = async (page: Page) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Files').click()
  await expect(filesSettings(page).getByText('Warn me if I have less than', {exact: true})).toBeVisible({timeout: 10_000})
}

// The threshold the dropdown shows ("100 MB", "1 GB", ...), and whether the warning is on.
const shown = async (page: Page) => {
  const row = filesSettings(page).getByText('Warn me if I have less than', {exact: true}).locator('xpath=..')
  const checked = await filesSettings(page)
    .locator('.icon-gen-iconfont-check')
    .evaluate(el => (globalThis as unknown as {getComputedStyle: (e: unknown) => {opacity: string}}).getComputedStyle(el).opacity !== '0')
  return {checked, value: (await row.innerText()).replace('Warn me if I have less than', '').replace('of storage space remaining', '').trim()}
}

test('low-space threshold', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const original = await threshold()
  // a value other than the one there, from the dropdown's own list
  const want = original === gb ? 3 * gb : gb
  const wantText = want === gb ? '1 GB' : '3 GB'
  await withCleanup(
    async () => {
      await openFilesSettings(page)
      if (original === 0) {
        // the warning is off: turning it on sets the default before a size can be picked
        await filesSettings(page).locator('.icon-gen-iconfont-check').click()
        await expect.poll(threshold, {message: 'the threshold after turning the warning on', timeout: 10_000}).toBeGreaterThan(0)
      }
      const dropdown = filesSettings(page).getByText('Warn me if I have less than', {exact: true}).locator('xpath=..').getByText(/^\d+ [MG]B$/)
      await expect(dropdown).toHaveCount(1, {timeout: 10_000})
      await dropdown.click()
      await page.getByText(wantText, {exact: true}).locator('visible=true').last().click()
      await expect.poll(threshold, {message: 'the threshold from the service', timeout: 10_000}).toBe(want)
      await expect.poll(async () => shown(page), {message: 'the threshold shown'}).toEqual({checked: true, value: wantText})
      await step(page, testInfo, 'threshold changed', {card: true})
      await expectPersists(
        page,
        async () => {
          await openFilesSettings(page)
          let got = await shown(page)
          await expect.poll(async () => (got = await shown(page)), {message: 'the threshold shown after a reload', timeout: 10_000}).toEqual({
            checked: true,
            value: wantText,
          })
          return got
        },
        {checked: true, value: wantText},
        'the low-space threshold'
      )
    },
    [
      async () => {
        await mainRpc('keybase.1.SimpleFS.simpleFSSetNotificationThreshold', {threshold: original})
        expect(await threshold(), 'the threshold after the restore').toBe(original)
      },
    ]
  )
})
