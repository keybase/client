import type {Page} from '@playwright/test'
import {newDeviceOf} from '@/tests/e2e/accounts/device-targets'
import {loadE2EAccounts, loadE2EEnv} from '@/tests/e2e/accounts/env'
import {forgetPaperKey, readPaperKeys, recordPaperKey} from '@/tests/e2e/accounts/paper-key-ledger'
import {
  deviceCounts,
  deviceHistory,
  expectRevokedInList,
  listedDevices,
  requireRevocable,
  revokeInApp,
  scrollToDeviceRow,
} from '@/tests/e2e/electron/helpers/devices'
import {e2eRunId, expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'
import {navigateToDevices} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

// Makes a paper key from the app (Devices > Add > paper key), records it in the paper key ledger at
// once (so a run that dies after this leaves it to the sweeper), then revokes it in the app. Its 13
// words are on screen while the screen is up: a style hides them (hidden from screenshots and from
// the accessibility snapshot a failure records) from before the screen opens until it has closed,
// and nothing reads them.
test.describe.configure({retries: 0})
test.use({actionTimeout: 10_000, trace: 'off'})
test.afterEach(async () => {
  await requireMainIsSmoke(loadE2EAccounts())
})

const WORDS = `[data-testid="${T.DEVICES_PAPER_KEY_WORDS}"]`
const HIDE_WORDS = `${WORDS}, ${WORDS} * { visibility: hidden !important; }`

type El = {textContent: string | null; querySelectorAll: (q: string) => ArrayLike<El>}
type Dom = {document: {querySelector: (q: string) => El | null}; getComputedStyle: (e: El) => {visibility: string}}

// Whether the words box is gone, shown empty (the key is still being made), or holds words that are
// all hidden ('hidden') or not ('shown'). Reads only lengths and styles.
const wordsState = async (page: Page) =>
  page
    .evaluate(sel => {
      const g = globalThis as unknown as Dom
      const box = g.document.querySelector(sel)
      if (!box) return 'gone'
      if (!(box.textContent ?? '').trim().length) return 'empty'
      const all = [box, ...Array.from(box.querySelectorAll('*'))]
      return all.every(e => g.getComputedStyle(e).visibility === 'hidden') ? 'hidden' : 'shown'
    }, WORDS)
    .catch(() => 'unknown')

test('make a paper key, then revoke it', async ({page}, testInfo) => {
  testInfo.setTimeout(180_000)
  const env = loadE2EEnv()
  const runId = e2eRunId()
  const before = await listedDevices()

  await navigateToDevices(page)
  const counts = await deviceCounts(page)
  await page.getByText('Add a device or paper key', {exact: true}).click()
  await expect(page.getByTestId(T.DEVICES_ADD_DEVICE)).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'add a device')

  const hide = await page.addStyleTag({content: HIDE_WORDS})
  let made: {deviceID: string; name: string} | undefined
  let failed: Error | undefined
  try {
    // sends login.paperKey, which makes the key, then shows its words
    await page.getByText('Create a paper key', {exact: true}).click()
    let listed: ReturnType<typeof newDeviceOf>
    await expect
      .poll(async () => (listed = newDeviceOf(before, await listedDevices(), 'backup')) !== undefined, {timeout: 30_000})
      .toBe(true)
    if (!listed) throw new Error('no new paper key device')
    // A key the service made but deviceList did not show yet when a run died is never recorded, so never swept.
    // the ledger takes the name as deviceList gives it, which is what the sweeper compares
    recordPaperKey({deviceID: listed.deviceID, deviceName: listed.name, runId})
    const id = listed.deviceID
    const name = (await deviceHistory()).find(d => d.deviceID === id)?.name ?? ''
    made = {deviceID: id, name}
    await expect.poll(async () => wordsState(page), {timeout: 30_000}).toBe('hidden')
    await step(page, testInfo, 'paper key made, its words hidden', {card: true})
    await page.getByText('Yes, I wrote this down.', {exact: true}).click()
    await page.getByText('Done', {exact: true}).locator('visible=true').click()
    await expect.poll(async () => wordsState(page), {timeout: 10_000}).toBe('gone')
  } catch (e) {
    failed = e instanceof Error ? e : new Error('making the paper key failed')
  }
  // the style stays until the screen is gone
  if ((await wordsState(page)) !== 'gone') {
    await closeModal(page).catch(() => {})
    await expect.poll(async () => wordsState(page), {timeout: 10_000}).toBe('gone')
  }
  await hide.evaluate(e => (e as unknown as {remove: () => void}).remove())
  if (failed) throw failed
  if (!made?.name) throw new Error('the new paper key has no device name in the device history')
  const key = made

  await expect.poll(async () => (await deviceCounts(page)).active, {timeout: 30_000}).toBe(counts.active + 1)
  await expect(await scrollToDeviceRow(page, made.name)).toBeVisible()
  await step(page, testInfo, 'the paper key is listed')

  if (!readPaperKeys().some(e => e.deviceID === key.deviceID && e.runId === runId)) {
    throw new Error('refusing to revoke: the paper key ledger has no entry for it from this run')
  }
  await requireRevocable(env, made)
  const beforeRevoke = await deviceCounts(page)
  // sends revoke.revokeDevice
  await revokeInApp(page, made.name, 'paper key', async () => step(page, testInfo, 'revoke confirm names the paper key'))
  await expectRevokedInList(page, made.name, beforeRevoke)
  const id = made.deviceID
  await expect.poll(async () => (await deviceHistory()).filter(d => d.deviceID === id).map(d => d.revoked), {timeout: 30_000}).toEqual([true])
  await step(page, testInfo, 'revoked')
  forgetPaperKey(id)
  expect(readPaperKeys().some(e => e.deviceID === id)).toBe(false)
})
