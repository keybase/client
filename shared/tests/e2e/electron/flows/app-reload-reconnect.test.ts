// The main window across a reload of its renderer and a lost connection to the service: a reload
// keeps the open conversation's draft; a dropped connection shows the disconnect
// overlay until the app reconnects, and a send after it reaches the service. Settings > About's
// links go to the OS's browser (recorded in the main process, so no browser opens).
//
// The dropped connection is only the app's own: dropServiceSocket closes the main process's socket
// to the service, and the service keeps running.
import type {Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {composer, composerInput, openE2EChannel, threadHeaderTitle, waitForRow, watchOutgoingRpcs} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {e2eMarker, e2eRunId, expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {navigateToChat, navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {reloadKeepingCoverage} from '@/tests/e2e/electron/helpers/persisted'
import {step} from '@/tests/e2e/electron/helpers/step'
import {E2E_CHANNELS, readFromCli} from '@/tests/e2e/shared/chat-data'
import {mainWhoami, requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

test.afterEach(async () => {
  await requireMainIsSmoke(loadE2EAccounts())
})

const scratchTitle = () => `${loadE2EAccounts().team}#${E2E_CHANNELS.scratch}`

// Empties the scratch channel's composer and checks, after a reload, that no draft came back.
const clearDraft = async (page: Page) => {
  await navigateToChat(page)
  if ((await threadHeaderTitle(page).innerText({timeout: 5_000}).catch(() => '')) !== scratchTitle()) await openE2EChannel(page)
  if ((await composer.getText(page)) !== '') await composerInput(page).fill('', {timeout: 5_000})
  // leaving the conversation saves its draft now
  await openE2EChannel(page, E2E_CHANNELS.short)
  await reloadKeepingCoverage(page)
  await openE2EChannel(page)
  await expect(composerInput(page), 'the scratch composer after clearing the draft and a reload').toHaveValue('', {timeout: 10_000})
}

// Desktop starts on its first tab after a reload (only the phone saves its route,
// util/storeless-actions.tsx persistRoute), so the conversation is opened again to read its draft.
test('a draft typed in the open conversation survives a reload', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const draft = `e2e-${e2eRunId()}-draft`
  await withCleanup(
    async () => {
      await openE2EChannel(page)
      const rpcs = await watchOutgoingRpcs(page)
      try {
        await composer.type(page, draft)
        await expect(composerInput(page)).toHaveValue(draft)
        // the composer saves its draft a moment after the last key
        await expect
          .poll(() => rpcs.seen().some(c => c.method === 'chat.1.local.updateUnsentText' && c.params.includes(draft)), {
            message: 'the draft saved to the service',
            timeout: 10_000,
          })
          .toBe(true)
      } finally {
        await rpcs.stop()
      }
      await step(page, testInfo, 'draft typed in scratch')
      await reloadKeepingCoverage(page)
      await openE2EChannel(page)
      await expect(composerInput(page), 'the draft after the reload').toHaveValue(draft, {timeout: 15_000})
      await step(page, testInfo, 'after reload: scratch has its draft', {card: true})
    },
    [async () => clearDraft(page)]
  )
})

test("About's Terms and Privacy Policy open in the browser", async ({page}, testInfo) => {
  const mp = await connectMainProcess()
  // a click without the stub would open a real browser
  expect(await mp.recordExternalUrls(), 'the openExternal stub in the main process').toBe(true)
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ROW_ABOUT).click()
  await expect(page.getByTestId(T.SETTINGS_ABOUT)).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'about', {card: true})
  await page.getByText('Terms and Conditions', {exact: true}).click()
  await expect.poll(async () => mp.takeExternalUrls(), {message: 'the URL Terms hands the OS', timeout: 10_000}).toEqual([
    'https://keybase.io/_/webview/terms',
  ])
  await page.getByText('Privacy Policy', {exact: true}).click()
  await expect.poll(async () => mp.takeExternalUrls(), {message: 'the URL Privacy Policy hands the OS', timeout: 10_000}).toEqual([
    'https://keybase.io/_/webview/privacypolicy',
  ])
})

type DaemonStore = {getState: () => {error?: unknown; handshakeState: string}}
// The main window's connection to the service: up once its handshake is done with no error.
const appConnected = async (page: Page) =>
  page.evaluate(() => {
    const s = ((globalThis as unknown as {__ZUSTAND_HMR__?: Map<string, unknown>}).__ZUSTAND_HMR__?.get('daemon') as DaemonStore | undefined)?.getState()
    if (!s) throw new Error('the daemon store is not in __ZUSTAND_HMR__; is this a dev build?')
    return s.handshakeState === 'done' && !s.error
  })

test('the app reconnects after the service socket drops', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const {smokeUser} = loadE2EAccounts()
  const overlay = page.getByTestId(T.DISCONNECT_OVERLAY)
  await openE2EChannel(page)
  expect(await appConnected(page), 'the app connected before the drop').toBe(true)
  await expect(overlay).toHaveCount(0)

  const mp = await connectMainProcess()
  const dropped = await mp.dropServiceSocket()
  expect(dropped, "the app's sockets to the service that were closed").toBeGreaterThanOrEqual(1)
  await expect(overlay, 'the disconnect overlay after the drop').toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'disconnected', {card: true})
  await expect(overlay, 'the disconnect overlay clearing as the app reconnects').toHaveCount(0, {timeout: 30_000})
  await expect.poll(async () => appConnected(page), {message: 'the app connected again', timeout: 30_000}).toBe(true)
  await expect(page.getByTestId(T.NAV_TAB_CHAT)).toBeVisible()
  await step(page, testInfo, 'reconnected')

  const text = e2eMarker('reconnect')
  await openE2EChannel(page)
  await composerInput(page).fill(text, {timeout: 5_000})
  await composerInput(page).press('Enter', {timeout: 5_000})
  await waitForRow(page, text)
  await expect
    .poll(async () => (await readFromCli({topicName: E2E_CHANNELS.scratch}, 20)).some(m => m.content.text?.body === text), {
      message: 'the message sent after the reconnect, from the CLI',
      timeout: 30_000,
    })
    .toBe(true)
  await step(page, testInfo, 'sent after reconnect')
  // the service never went down: it still answers as the smoke account
  expect((await mainWhoami()).trim()).toBe(smokeUser)
})
