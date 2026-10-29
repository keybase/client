import type {Page} from '@playwright/test'
import escapeRegExp from 'lodash/escapeRegExp'
import {asSecond, pressHeaderBack, RESTORE_WORST_MS, restoreToSmoke, signedOutThenBack} from '@/tests/e2e/electron/helpers/accounts'
import {loadE2EEnv, requireSecondPassword} from '@/tests/e2e/accounts/env'
import {CHECK_OR_REPAIR_WORST_MS, checkOrRepairSecondSecret} from '@/tests/e2e/accounts/second-password-lib'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {appRepairDeps} from '@/tests/e2e/electron/helpers/second-sign-in'
import {step} from '@/tests/e2e/electron/helpers/step'
import {deviceNameCandidates, requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

// Forgot password, for the second account, signed out: the device list, a device's instructions, a
// wrong paper key, and the reset prompt. Nothing here can change the account: no real paper key is
// ever submitted (a correct one logs in, and cancelling the new password then logs the account out
// with its stored secret dropped), and "Start account reset" is never pressed (it enters the reset
// pipeline).
test.describe.configure({mode: 'serial'})
// Signing the second account out from here can drop its stored secret on the main service, so
// afterAll checks it and, when it is gone, repairs it by typing KB_SECOND_PASSWORD: a retry's trace
// snapshots every input's value, and a retry would type it again, so this file never retries and
// never traces.
test.describe.configure({retries: 0})
// Every action is bounded, so a flow stuck on a screen fails with time left for the sign-in back to
// smoke; afterEach signs smoke in again if a failure left the app elsewhere.
test.use({actionTimeout: 10_000, trace: 'off'})
test.afterEach(async ({page}, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + RESTORE_WORST_MS)
  await restoreToSmoke(page)
})
// The repair signs in on this worker's own page (untraced, as above).
test.afterAll(async ({_electronPage}, testInfo) => {
  // the default 30s would kill a repair part way and leave the main service signed out
  testInfo.setTimeout(CHECK_OR_REPAIR_WORST_MS + 15_000)
  const env = loadE2EEnv()
  await checkOrRepairSecondSecret(env, requireSecondPassword(env), appRepairDeps(_electronPage))
  await requireMainIsSmoke(env)
})
// signing out and back in twice (second, then smoke) on top of the flow itself
test.describe.configure({timeout: 120_000})

const loginList = (page: Page) => page.getByTestId(T.LOGIN_USER_LIST)
const deviceRow = (page: Page, name: string | RegExp) =>
  page.getByText(name, {exact: typeof name === 'string'}).locator('visible=true')
const lostAll = (page: Page) => page.getByText('I lost all my devices/paper keys', {exact: true}).locator('visible=true')
const peerDevice = new RegExp(`^(${deviceNameCandidates('second').map(escapeRegExp).join('|')})$`)
// A well-formed paper key (thirteen words from the word list, the last one carrying version 0) that
// is no one's: the service's format checks pass, so it is refused by the key match itself.
const wrongPaperKey = 'abandon ability able about above absent absorb abstract absurd abuse access accident acid'

// Signed out from the second account (so the login screen has it selected, and Forgot password
// recovers it without a click on its row, which would sign it in), then back to smoke.
const fromSecondsLoginScreen = async (page: Page, f: () => Promise<void>) =>
  asSecond(page, async () => signedOutThenBack(page, f))

const openDeviceSelector = async (page: Page) => {
  await expect(loginList(page)).toBeVisible()
  await page.getByText('Forgot password?', {exact: true}).click()
  await expect(lostAll(page)).toBeVisible({timeout: 20_000})
  await expect(page.getByText('Which do you have handy?', {exact: true}).locator('visible=true')).toBeVisible()
}

test('forgot password lists the devices, explains one, and refuses a wrong paper key', async ({page}, testInfo) => {
  await fromSecondsLoginScreen(page, async () => {
    await openDeviceSelector(page)
    await expect(deviceRow(page, peerDevice).first()).toBeVisible()
    await step(page, testInfo, "second's devices", {card: true})

    const peerName = await deviceRow(page, peerDevice).first().innerText()
    await deviceRow(page, peerDevice).first().click()
    await expect(page.getByText(peerName, {exact: true}).locator('visible=true')).toBeVisible({timeout: 20_000})
    await expect(page.getByText('Got it', {exact: true}).locator('visible=true')).toBeVisible()
    await step(page, testInfo, 'device explained')

    // back starts the recovery again, at the device list
    await pressHeaderBack(page)
    await expect(lostAll(page)).toBeVisible({timeout: 20_000})
    await page.getByText('Paper key', {exact: true}).locator('visible=true').first().click()
    const input = page.getByPlaceholder('Type your paper key', {exact: true})
    await expect(input).toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'paper key screen')

    await input.fill(wrongPaperKey)
    await page.getByText('Continue', {exact: true}).locator('visible=true').click()
    const failed = page.getByText('Password recovery failed', {exact: true}).locator('visible=true')
    await expect(failed).toBeVisible({timeout: 20_000})
    await expect(page.getByText(/no matching paper backup keys found/).locator('visible=true')).toBeVisible()
    await step(page, testInfo, 'recovery failed')
    await pressHeaderBack(page)
    await expect(loginList(page)).toBeVisible({timeout: 10_000})
  })
})

test('lost all devices offers the account reset, which is never started', async ({page}, testInfo) => {
  await fromSecondsLoginScreen(page, async () => {
    await openDeviceSelector(page)
    await lostAll(page).click()
    const start = page.getByText('Start account reset', {exact: true}).locator('visible=true')
    await expect(start).toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'reset prompt', {card: true})
    // back starts the recovery again; back once more cancels it
    await pressHeaderBack(page)
    await expect(lostAll(page)).toBeVisible({timeout: 20_000})
    await pressHeaderBack(page)
    await expect(loginList(page)).toBeVisible({timeout: 10_000})
  })
})
