import * as fs from 'fs'
import type {Page} from '@playwright/test'
import {loadE2EAccounts, loadE2EEnv, provisionHomeFor} from '@/tests/e2e/accounts/env'
import {checkRetirablePeerHome, readPeerConfig, removeRetiredPeerHome, retirePeerHome, stopPeerHomeService} from '@/tests/e2e/accounts/peer-homes'
import {
  deviceCounts,
  deviceHistory,
  expectRevokedInList,
  findDeviceRow,
  mainDevice,
  requireRevocable,
  revokeInApp,
  scrollToDeviceRow,
} from '@/tests/e2e/electron/helpers/devices'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {e2eRunId, expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'
import {navigateToDevices} from '@/tests/e2e/electron/helpers/navigate'
import {startProvisionee, type Provisionee} from '@/tests/e2e/accounts/provisionee'
import {emptyFocusedField, insertSecret, pressReturn, withoutSecret} from '@/tests/e2e/electron/helpers/secret-input'
import {step} from '@/tests/e2e/electron/helpers/step'
import {withDeadline} from '@/tests/e2e/shared/deadline'
import {
  peerCli,
  peerUsesFileSecretStore,
  requireMainIsSmoke,
  setPeerFileSecretStore,
  socketAnswers,
  socketPathFor,
  waitForPeerService,
} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

// Adds a computer from the app: a new peer home (homes/prov-<runid>, the file secret store) runs
// `keybase login` as the smoke account and prints its verification phrase; the app's code page takes
// it. Then the new home is shut down and the app revokes its device. The phrase is a secret: only the
// main process types it (secret-input.ts), and no step, action or assertion runs while the code page
// holds it. Keybase never lets a device name be used twice, so this runs once per run id.
test.describe.configure({retries: 0})
test.use({actionTimeout: 10_000, trace: 'off'})
test.afterEach(async () => {
  await requireMainIsSmoke(loadE2EAccounts())
})

const PHRASE_WINDOW = 'main.html'
const PHRASE_FIELD = 'textarea[placeholder="Type the 8-word secret code"]'

type Dom = {document: {querySelector: (q: string) => unknown}}
const codePageOpen = async (page: Page) =>
  page.evaluate(sel => !!(globalThis as unknown as Dom).document.querySelector(sel), PHRASE_FIELD).catch(() => true)

// Types the phrase and submits it; resolves once the code page has closed (the app's success: the
// provisioning RPC ended and cleared its screens). On failure the field is emptied and the code page
// closed before an error naming no value is thrown.
const submitPhrase = async (page: Page, phrase: string) => {
  // the field is still empty here
  await page.locator(PHRASE_FIELD).click()
  let failure: string | undefined
  try {
    failure = await insertSecret(page, PHRASE_WINDOW, PHRASE_FIELD, phrase)
    if (!failure) await pressReturn(PHRASE_WINDOW)
    const deadline = Date.now() + 60_000
    while (!failure && Date.now() < deadline) {
      if (!(await codePageOpen(page))) return
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    failure ??= 'the code page did not close within 60s of submitting the phrase'
  } catch (e) {
    failure = `submitting the phrase failed: ${withoutSecret(e, phrase)}`
  }
  // the field is emptied and the code page closed on every path, before any error leaves here
  const cleanup: Array<string> = []
  try {
    await emptyFocusedField(page, PHRASE_WINDOW, PHRASE_FIELD)
  } catch (e) {
    cleanup.push(withoutSecret(e, phrase))
  } finally {
    await closeModal(page).catch((e: unknown) => cleanup.push(`closing the code page: ${withoutSecret(e, phrase)}`))
  }
  throw new Error(`the app did not show success: ${failure}${cleanup.length ? `; then ${cleanup.join('; ')}` : ''}`)
}

test('add a computer from the app, then revoke it', async ({page}, testInfo) => {
  // the CLI's provisioning, the app's, a shutdown and a revoke, each with its own deadline
  testInfo.setTimeout(300_000)
  const env = loadE2EEnv()
  const runId = e2eRunId()
  const home = provisionHomeFor(runId)
  const name = `e2e-${runId}-prov`
  const keep = env.peers.owner.home
  if (fs.existsSync(home)) throw new Error(`${home} already exists: this run id already provisioned its device (one per run id)`)

  // The file secret store before the home's service ever starts: peer homes share the Keychain by
  // username, so a home on it would overwrite the main service's stored secret.
  fs.mkdirSync(home, {mode: 0o700, recursive: true})
  setPeerFileSecretStore(home)
  if (!peerUsesFileSecretStore(home)) throw new Error(`${home} does not keep its secret in a file; refusing to start it`)
  await waitForPeerService('owner', home)
  if (!peerUsesFileSecretStore(home)) throw new Error(`${home}'s running service dropped the file secret store; refusing to log in`)

  const main = await mainDevice()
  let provisionee: Provisionee | undefined
  let finished = false
  await withCleanup(
    async () => {
      await navigateToDevices(page)
      await page.getByText('Add a device or paper key', {exact: true}).click()
      await expect(page.getByTestId(T.DEVICES_ADD_DEVICE)).toBeVisible({timeout: 10_000})
      await step(page, testInfo, 'add a device')

      provisionee = startProvisionee({deviceName: name, fromDevice: main.name, home, user: env.smokeUser})
      // sends device.deviceAdd; its secret exchange opens the code page
      await page.getByText('Add a computer', {exact: true}).click()
      await expect(page.locator(PHRASE_FIELD)).toBeVisible({timeout: 30_000})
      await step(page, testInfo, 'code page, nothing typed', {card: true})
      const phrase = await withDeadline(provisionee.phrase, 60_000, 'the new home printing its verification phrase')
      await submitPhrase(page, phrase)
      await withDeadline(provisionee.done, 120_000, 'keybase login in the new home finishing')

      await expect.poll(async () => !!(await findDeviceRow(page, name)), {timeout: 30_000}).toBe(true)
      await expect(await scrollToDeviceRow(page, name)).toBeVisible()
      await step(page, testInfo, 'the new computer is listed')
      expect(await peerCli(home)(['whoami'], 15_000)).toBe(env.smokeUser)

      // shut down before the revoke, so the device never acts on its own revoke
      checkRetirablePeerHome(home, keep)
      await stopPeerHomeService(home)
      expect(await socketAnswers(socketPathFor(home))).toBe(false)

      const deviceID = readPeerConfig(home).users?.[env.smokeUser]?.device ?? ''
      await requireRevocable(env, {deviceID, name})
      const before = await deviceCounts(page)
      // sends revoke.revokeDevice
      await revokeInApp(page, name, 'computer', async () => step(page, testInfo, 'revoke confirm names the device'))
      await expectRevokedInList(page, name, before)
      await expect.poll(async () => (await deviceHistory()).filter(d => d.deviceID === deviceID).map(d => d.revoked), {timeout: 30_000}).toEqual([true])
      await step(page, testInfo, 'revoked')

      await retirePeerHome(
        {newHome: keep, oldHome: home, role: 'owner', user: env.smokeUser},
        {
          remove: async h => removeRetiredPeerHome(h, keep, env.smokeUser, () => {}),
          // revoked above, in the app: only checked here
          revoke: async old => {
            const revoked = (await deviceHistory()).find(d => d.deviceID === old)?.revoked
            if (old !== deviceID || !revoked) throw new Error(`refusing to retire ${home}: its device is not the one the app revoked`)
          },
          say: () => {},
          stop: stopPeerHomeService,
        }
      )
      expect(fs.existsSync(home)).toBe(false)
      finished = true
    },
    [
      async () => {
        provisionee?.kill()
        // A failure leaves a provisioned device for the sweeper, with its home's service shut down; a
        // home that never signed in has no device for the sweeper to find, so it goes now.
        if (finished || !fs.existsSync(home)) return
        checkRetirablePeerHome(home, keep)
        await stopPeerHomeService(home)
        if (!Object.keys(readPeerConfig(home).users ?? {}).length) await removeRetiredPeerHome(home, keep, env.smokeUser, () => {})
      },
    ]
  )
})
