// The harness's own app-driving helpers, each checked against the app: a file dropped from disk, a
// main-process dialog answered by a stub, and the account wrapper's restore.
import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {step} from '@/tests/e2e/electron/helpers/step'
import {navigateToCrypto} from '@/tests/e2e/electron/helpers/navigate'
import {dropFiles} from '@/tests/e2e/electron/helpers/drop'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {asSecond} from '@/tests/e2e/electron/helpers/accounts'
import {signedInAs} from '@/tests/e2e/electron/helpers/chat'
import {CORPUS} from '@/tests/e2e/fixtures/corpus/corpus'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {mainWhoami} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

const corpusFile = (name: string) => {
  const c = CORPUS.find(x => x.name === name)
  if (!c) throw new Error(`${name} is not in CORPUS`)
  return c.file
}

// The crypto screens keep their input across tests (crypto-outputs leaves text in them), and the
// text input offers "browse" only while it is empty: each test starts and ends with it cleared.
const clearCryptoInput = async (page: Page, testID: string) => {
  const clear = page.getByTestId(testID).locator('visible=true').getByText('Clear', {exact: true})
  if (await clear.isVisible()) await clear.click({timeout: 5_000})
  await expect(clear).toHaveCount(0)
}

test('a dropped corpus file shows in the encrypt input', async ({page}, testInfo) => {
  const file = corpusFile('e2e c ünïcode.txt')
  await navigateToCrypto(page)
  await page.getByTestId(T.CRYPTO_NAV_ENCRYPT).first().click()
  const input = page.getByTestId(T.CRYPTO_ENCRYPT_INPUT).locator('visible=true').first()
  await expect(input).toBeVisible()
  await clearCryptoInput(page, T.CRYPTO_ENCRYPT_INPUT)
  await step(page, testInfo, 'encrypt input empty')
  try {
    await dropFiles(page, input, [file])
    await expect(input.getByText(file, {exact: true})).toBeVisible()
    await step(page, testInfo, 'dropped file shown', {card: true})
  } finally {
    await clearCryptoInput(page, T.CRYPTO_ENCRYPT_INPUT)
  }
})

test.describe('the main-process dialog stub', () => {
  test.describe.configure({mode: 'serial'})

  test('a stubbed open dialog answers the app', async ({page}, testInfo) => {
    const file = corpusFile('e2e-c.png')
    const main = await connectMainProcess()
    await main.stubOpenDialog([file])
    await navigateToCrypto(page)
    await page.getByTestId(T.CRYPTO_NAV_SIGN).first().click()
    const input = page.getByTestId(T.CRYPTO_SIGN_INPUT).locator('visible=true').first()
    await expect(input).toBeVisible()
    await clearCryptoInput(page, T.CRYPTO_SIGN_INPUT)
    await step(page, testInfo, 'sign input empty')
    try {
      await input.getByText('browse', {exact: true}).click({timeout: 5_000})
      await expect(page.getByTestId(T.CRYPTO_SIGN_INPUT).getByText(file, {exact: true})).toBeVisible()
      await step(page, testInfo, 'picked file shown', {card: true})
    } finally {
      await clearCryptoInput(page, T.CRYPTO_SIGN_INPUT)
    }
  })

  test('the stub is gone after the test that installed it', async () => {
    const main = await connectMainProcess()
    expect(await main.eval('typeof Electron.dialog.showOpenDialog.__kbStub')).toBe('undefined')
  })
})

test('asSecond restores smoke when its body throws', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const {secondUser, smokeUser} = loadE2EAccounts()
  await expect(
    asSecond(page, async () => {
      expect(await signedInAs(page)).toBe(secondUser)
      await step(page, testInfo, 'as second')
      throw new Error('x')
    })
  ).rejects.toThrow(/^x$/)
  expect(await signedInAs(page)).toBe(smokeUser)
  expect(await mainWhoami()).toBe(smokeUser)
  await step(page, testInfo, 'back as smoke', {card: true})
})
