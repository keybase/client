import type {BrowserContext, Page} from '@playwright/test'
import {loadE2EAccounts, loadE2EEnv} from '@/tests/e2e/accounts/env'
import {watchOutgoingRpcs} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {e2eRunId, expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {emptyFocusedField, insertSecret, withoutSecret} from '@/tests/e2e/electron/helpers/secret-input'
import {step} from '@/tests/e2e/electron/helpers/step'
import {closeUnlockFoldersAsApp, openUnlockFoldersAsRekey, unlockFoldersOpen, type UnlockFoldersDevice} from '@/tests/e2e/electron/helpers/windows'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

// The unlock-folders window, opened as the service's rekey prompt opens it, takes a paper key: a
// wrong one shows the service's error, the smoke account's own (KB_OWNER_PAPERKEY) closes it. A
// paper key submitted here only unlocks it for rekeying (PaperKeySubmit caches it); it never
// provisions anything. The key is a secret: only the main process types it (secret-input.ts), no
// step, action or assertion runs while the field holds it, and on a failure the field is emptied and
// the window closed before the error.
test.describe.configure({retries: 0})
test.use({actionTimeout: 10_000, trace: 'off'})
test.afterEach(async () => {
  await requireMainIsSmoke(loadE2EAccounts())
})

const WINDOW = 'component=unlock-folders'
const FIELD = 'textarea'
// twelve words that are no paper key
const WRONG = 'e2e wrong words that are not any paper key of this account'

type Dom = {document: {querySelectorAll: (q: string) => ArrayLike<{textContent: string | null; children: {length: number}; click: () => void}>}}
type ErrorStore = {getState: () => {paperKeyError: string}}
type DevGlobals = {__ZUSTAND_HMR__?: Map<string, unknown>}

// The error the main window's store holds for the window, from the service.
const storeError = async (main: Page) =>
  main.evaluate(() => ((globalThis as unknown as DevGlobals).__ZUSTAND_HMR__?.get('unlock-folders') as ErrorStore | undefined)?.getState().paperKeyError ?? '')

// Continue, clicked in the page rather than by a Playwright action (the field may hold the key).
const clickContinue = async (win: Page) =>
  win.evaluate(() => {
    const label = Array.from((globalThis as unknown as Dom).document.querySelectorAll('*')).find(e => e.textContent === 'Continue' && !e.children.length)
    if (!label) return false
    label.click()
    return true
  })

// Types the key and submits it; resolves once the window has closed. On failure the field is emptied
// and the window closed before an error naming no value is thrown.
const submitPaperKey = async (context: BrowserContext, main: Page, win: Page, key: string) => {
  // the field is empty here
  await win.locator(FIELD).click()
  let failure: string | undefined
  try {
    failure = await insertSecret(win, WINDOW, FIELD, key)
    if (!failure && !(await clickContinue(win))) failure = 'no Continue button in the window'
    // sends login.paperKeySubmit; the window closes once the service accepts the key
    const deadline = Date.now() + 30_000
    while (!failure && Date.now() < deadline) {
      if (!unlockFoldersOpen(context)) {
        // closed by an accepted key, not by an error or anything else
        const error = await storeError(main)
        if (!error) return
        throw new Error(`the window closed, but the service refused the key: ${withoutSecret(new Error(error), key)}`)
      }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    failure ??= 'the window did not close within 30s of submitting the paper key'
  } catch (e) {
    failure = withoutSecret(e, key)
  }
  // the field is emptied and the window closed on every path, before any error leaves here
  const cleanup: Array<string> = []
  if (unlockFoldersOpen(context)) {
    try {
      await emptyFocusedField(win, WINDOW, FIELD)
    } catch (e) {
      cleanup.push(withoutSecret(e, key))
    } finally {
      await closeUnlockFoldersAsApp(context, main).catch((e: unknown) => cleanup.push(`closing the window: ${withoutSecret(e, key)}`))
    }
  }
  throw new Error(`${failure}${cleanup.length ? `; then ${cleanup.join('; ')}` : ''}`)
}

test('a wrong paper key shows the error, the right one closes the window', async ({page}, testInfo) => {
  // above every wait inside submitPaperKey, so its cleanup always runs before the test is cut off
  testInfo.setTimeout(120_000)
  const context = page.context()
  const key = loadE2EEnv().peers.owner.paperKey
  if (!key) throw new Error('KB_OWNER_PAPERKEY is not set in the e2e env file (yarn test:e2e:accounts:setup)')
  const runId = e2eRunId()
  const devices: Array<UnlockFoldersDevice> = [
    {deviceID: `e2e-${runId}-computer`, name: `e2e-${runId}-computer`, type: 'desktop'},
    {deviceID: `e2e-${runId}-phone`, name: `e2e-${runId}-phone`, type: 'mobile'},
  ]
  await withCleanup(
    async () => {
      const win = await openUnlockFoldersAsRekey(context, page, devices)
      await expect(win.getByTestId(T.UNLOCK_FOLDERS_DEVICES)).toBeVisible()
      await expect(win.getByText(devices[0]?.name ?? '', {exact: true})).toBeVisible()
      await step(win, testInfo, 'unlock folders lists the other devices', {card: true})

      await win.getByTestId(T.UNLOCK_FOLDERS_PAPER_KEY_BUTTON).click()
      const field = win.locator(FIELD)
      await expect(field).toBeVisible()
      await step(win, testInfo, 'paper key step, nothing typed')

      // not a secret: no paper key of the account
      await field.fill(WRONG)
      await win.getByText('Continue', {exact: true}).click()
      // sends login.paperKeySubmit; the service's refusal comes back through the main window's store
      await expect.poll(async () => storeError(page), {timeout: 30_000}).not.toBe('')
      await expect(win.getByText(await storeError(page), {exact: true})).toBeVisible({timeout: 10_000})
      await field.fill('')
      await step(win, testInfo, 'wrong paper key refused')

      await submitPaperKey(context, page, win, key)
      await step(page, testInfo, 'the right paper key closed the window')

      const again = await openUnlockFoldersAsRekey(context, page, devices)
      await expect(again.getByTestId(T.UNLOCK_FOLDERS_DEVICES)).toBeVisible()
      await step(again, testInfo, 'unlock folders again')
      // the close sends rekey.rekeyStatusFinish from the main window
      const rpcs = await watchOutgoingRpcs(page)
      try {
        await again.locator('.icon-gen-iconfont-close').click()
        await expect.poll(() => unlockFoldersOpen(context), {timeout: 10_000}).toBe(false)
        await expect
          .poll(() => rpcs.seen().some(c => c.method === 'keybase.1.rekey.rekeyStatusFinish'), {message: 'rekeyStatusFinish sent on close', timeout: 10_000})
          .toBe(true)
      } finally {
        await rpcs.stop()
      }
    },
    // a failure before the key was typed can leave the window open; the app's own close shuts it
    [
      async () => {
        if (unlockFoldersOpen(context)) await closeUnlockFoldersAsApp(context, page)
      },
    ]
  )
})
