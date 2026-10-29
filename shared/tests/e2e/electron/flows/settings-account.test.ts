// Settings > Account: an address for this run (e2e-<runid>-mail@example.com: example.com is reserved,
// so no mail reaches anyone) gets a verification mail sent again and is offered as the primary
// address, then deleted; the second account's password is changed in the app and signed in with;
// and the delete-account screen is opened and cancelled.
//
// The password change types the second account's password, which only the main-process typing in
// secret-input.ts ever does (no step, action or assertion while a field holds it). A retry's trace
// snapshots every input's value, so this file never retries and never traces.
import type {Page, TestInfo} from '@playwright/test'
import {defaultEnvPath, loadE2EAccounts, loadE2EEnv, requireSecondPassword} from '@/tests/e2e/accounts/env'
import {
  CHECK_OR_REPAIR_WORST_MS,
  checkOrRepairSecondSecret,
  checkSecondSecretSurvives,
  rotateSecondPassword,
} from '@/tests/e2e/accounts/second-password-lib'
import {asSecond, RESTORE_WORST_MS, restoreToSmoke} from '@/tests/e2e/electron/helpers/accounts'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {appRepairDeps, submitSecret} from '@/tests/e2e/electron/helpers/second-sign-in'
import {emptyFocusedField, fieldLengths, inWindow, insertSecret, pressReturn, withoutSecret} from '@/tests/e2e/electron/helpers/secret-input'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import {mainRpc, mainRpcAsSecond} from '@/tests/e2e/shared/main-rpc'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

test.describe.configure({retries: 0})
test.use({actionTimeout: 10_000, trace: 'off'})
// afterEach signs the smoke account in again if a failure left the app elsewhere
test.afterEach(async ({page}, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + RESTORE_WORST_MS)
  await restoreToSmoke(page)
})

// -- the account page ------------------------------------------------------------------------------

const accountPage = (page: Page) => page.getByTestId(T.SETTINGS_ACCOUNT_PAGE)

const openAccountPage = async (page: Page) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Account').first().click()
  await expect(accountPage(page).getByText('Email & phone').first()).toBeVisible({timeout: 10_000})
}
// ... with its emails loaded: the smoke account's primary address's row is always there
const openSmokeAccountPage = async (page: Page) => {
  await openAccountPage(page)
  await expect(accountPage(page).getByText(/Primary/).locator('visible=true').first(), 'the account emails to load').toBeVisible({timeout: 15_000})
}

// -- emails --------------------------------------------------------------------------------------

const EMAIL = `e2e-${e2eRunId()}-mail@example.com`

type Email = {email: string; isPrimary: boolean; isVerified: boolean; lastVerifyEmailDate: number}
const emails = async () => (await mainRpc<Array<Email> | null>('keybase.1.emails.getEmails', {sessionID: 0})) ?? []
const testEmail = async () => (await emails()).find(e => e.email === EMAIL)
const primaryEmail = async () => (await emails()).find(e => e.isPrimary)?.email

// An address's row: its name, and the line under it ("Primary", "Check your inbox", ...).
const emailRow = (page: Page, address: string) =>
  accountPage(page)
    .locator('div')
    .filter({has: page.getByText(address, {exact: true})})
    .filter({has: page.locator('.icon-gen-iconfont-gear')})
    .last()
const rowSubtitle = async (page: Page, address: string) =>
  (await emailRow(page, address).locator('.text_BodySmall').allInnerTexts()).join(' ').trim()
const rowGear = (page: Page, address: string) => emailRow(page, address).locator('.icon-gen-iconfont-gear').first()

const pickFromRowMenu = async (page: Page, address: string, item: string) => {
  const entry = page.getByText(item, {exact: true}).locator('visible=true')
  await openMenu(page, rowGear(page, address), entry, `${address}'s menu`)
  await entry.click()
}

const addTestEmail = async (page: Page, testInfo: TestInfo) => {
  expect(await testEmail(), 'the run address is not on the account before the flow').toBeUndefined()
  await accountPage(page).getByText('Add email', {exact: true}).click()
  const input = page.getByPlaceholder('Email address')
  await expect(input).toBeVisible({timeout: 5_000})
  await input.fill(EMAIL)
  await page.getByText('Continue', {exact: true}).click()
  await expect(input).toBeHidden({timeout: 15_000})
  await expect(emailRow(page, EMAIL), 'the added address row').toBeVisible({timeout: 15_000})
  await expect.poll(testEmail, {message: 'the added address on the server', timeout: 15_000}).toMatchObject({email: EMAIL, isVerified: false})
  await step(page, testInfo, 'address added')
}

const deleteTestEmailInApp = async (page: Page, testInfo: TestInfo) => {
  await pickFromRowMenu(page, EMAIL, 'Delete')
  await expect(page.getByText(`${EMAIL}?`).first(), 'the delete confirm').toBeVisible({timeout: 5_000})
  await page.getByText('Yes, delete', {exact: true}).click()
  await expect(emailRow(page, EMAIL), 'the address row after the delete').toHaveCount(0, {timeout: 15_000})
  await expect.poll(testEmail, {message: 'the address on the server after the delete', timeout: 15_000}).toBeUndefined()
  await step(page, testInfo, 'address deleted')
}

// Whatever the flow did: the run's address gone from the account, read back.
const removeTestEmail = async () => {
  if (await testEmail()) await mainRpc('keybase.1.emails.deleteEmail', {email: EMAIL, sessionID: 0})
  expect(await testEmail(), 'the run address after the cleanup').toBeUndefined()
}

test('resend email verification', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  await withCleanup(
    async () => {
      await openSmokeAccountPage(page)
      await addTestEmail(page, testInfo)
      const before = (await testEmail())?.lastVerifyEmailDate ?? 0
      // the server records the date in whole seconds: a resend in the same second as the add's own
      // mail would leave it unchanged, so the resend waits past that second
      await page.waitForTimeout(1_100)
      await pickFromRowMenu(page, EMAIL, 'Verify')
      await expect.poll(async () => (await testEmail())?.lastVerifyEmailDate ?? 0, {message: 'the server records the new verification mail', timeout: 20_000}).toBeGreaterThan(before)
      await expect.poll(async () => rowSubtitle(page, EMAIL), {message: "the row's verification-sent line"}).toContain('Check your inbox')
      await step(page, testInfo, 'verification sent', {card: true})
      await deleteTestEmailInApp(page, testInfo)
    },
    [removeTestEmail]
  )
})

test('make an unverified email primary', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const original = await primaryEmail()
  if (!original) throw new Error('the smoke account has no primary email')
  await withCleanup(
    async () => {
      await openSmokeAccountPage(page)
      await addTestEmail(page, testInfo)
      await pickFromRowMenu(page, EMAIL, 'Make primary')
      // pinned on the first run: the server takes an unverified address as the primary one
      await expect.poll(primaryEmail, {message: 'the primary address on the server', timeout: 20_000}).toBe(EMAIL)
      await expect.poll(async () => rowSubtitle(page, EMAIL), {message: "the run address's row"}).toContain('Primary')
      await step(page, testInfo, 'unverified address made primary', {card: true})
      // the original made primary again, in the app
      await pickFromRowMenu(page, original, 'Make primary')
      await expect.poll(primaryEmail, {message: 'the primary address on the server after the switch back', timeout: 20_000}).toBe(original)
      await expect.poll(async () => rowSubtitle(page, original), {message: "the original primary's row"}).toContain('Primary')
      expect(await rowSubtitle(page, EMAIL), "the run address's row after the switch back").not.toContain('Primary')
      await step(page, testInfo, 'original primary again')
      await deleteTestEmailInApp(page, testInfo)
    },
    [
      async () => {
        if ((await primaryEmail()) !== original) await mainRpc('keybase.1.emails.setPrimaryEmail', {email: original, sessionID: 0})
        expect(await primaryEmail(), 'the primary address after the cleanup').toBe(original)
      },
      removeTestEmail,
    ]
  )
})

test('delete account stops at its confirm', async ({page}, testInfo) => {
  await openSmokeAccountPage(page)
  await accountPage(page).getByText('Delete account', {exact: true}).locator('visible=true').last().click()
  const prompt = page.getByText('Permanently delete your account?', {exact: true}).locator('visible=true')
  await expect(prompt, 'the delete account confirm').toBeVisible({timeout: 10_000})
  await manualEdge(page, testInfo, 'delete-account-confirm')
  await page.getByText('Cancel', {exact: true}).locator('visible=true').last().click()
  await expect(prompt, 'the confirm after Cancel').toHaveCount(0, {timeout: 5_000})
  await expect(accountPage(page).getByText('Delete account', {exact: true}).first(), 'back on the Account page').toBeVisible()
  await requireMainIsSmoke(loadE2EAccounts())
  await step(page, testInfo, 'cancelled')
})

// -- the password ----------------------------------------------------------------------------------

const PASSWORD_FIELDS = 'input[type=password]'

type Dom = {document: {querySelectorAll: (q: string) => ArrayLike<{focus: () => void}>}}
const focusField = async (page: Page, index: number) =>
  page.evaluate(
    ({sel, i}) => {
      const f = (globalThis as unknown as Dom).document.querySelectorAll(sel)[i]
      f?.focus()
      return !!f
    },
    {i: index, sel: PASSWORD_FIELDS}
  )

// Empties both password fields with real editing commands (each one focused in turn), and reads
// back that neither holds anything; then closes the modal, which unmounts them.
const clearPasswordModal = async (page: Page) => {
  const mp = await connectMainProcess()
  for (const i of [1, 0]) {
    if (await focusField(page, i)) await mp.eval(inWindow('main.html', 'w.selectAll(); w.delete()'))
  }
  await emptyFocusedField(page, 'main.html', PASSWORD_FIELDS)
  await page.keyboard.press('Escape')
}

// Types `secret` into the change-password modal's two fields and saves, with no Playwright action or
// assertion while a field holds it; waits for the modal to close (the save went through). On a
// failure the fields are emptied and the modal closed before a plain error, naming no value, is
// thrown.
const saveNewPassword = async (page: Page, secret: string) => {
  const fields = page.locator(PASSWORD_FIELDS)
  await expect(fields, 'the new and confirm password fields').toHaveCount(2, {timeout: 10_000})
  // both fields are still empty here
  await fields.first().click()
  let failure: string | undefined
  try {
    failure = await insertSecret(page, 'main.html', PASSWORD_FIELDS, secret)
    if (!failure) {
      if (!(await focusField(page, 1))) failure = 'the confirm field is gone'
    }
    if (!failure) {
      failure = await insertSecret(page, 'main.html', PASSWORD_FIELDS, secret)
      const both = async () => (await fieldLengths(page, PASSWORD_FIELDS))?.every(n => n === secret.length) ?? false
      const typed = Date.now() + 5_000
      while (!failure && !(await both()) && Date.now() < typed) await new Promise(resolve => setTimeout(resolve, 50))
      if (!failure && !(await both())) failure = 'the two fields do not both hold the new password'
    }
    // Enter in the confirm field saves once both match
    if (!failure) await pressReturn('main.html')
    const closed = Date.now() + 60_000
    while (!failure && Date.now() < closed) {
      if ((await fieldLengths(page, PASSWORD_FIELDS))?.length === 0) return
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    failure ??= 'the change password modal did not close within 60s of saving'
  } catch (e) {
    failure = `saving the new password failed: ${withoutSecret(e, secret)}`
  }
  await clearPasswordModal(page)
  throw new Error(failure)
}

const loginList = (page: Page) => page.getByTestId(T.LOGIN_USER_LIST)
const loginPassword = (page: Page) => page.getByPlaceholder('Password', {exact: true}).locator('visible=true')

// The second account's stored secret on the main service is checked after every change (and
// repaired with the current password from the env file when it is gone). A rotation that stopped
// part way leaves KB_SECOND_PASSWORD_NEXT in the env file: then requireSecondPassword refuses and
// nothing is guessed.
test.describe('password', () => {
  test.describe.configure({mode: 'serial'})

  test.afterAll(async ({_electronPage}, testInfo) => {
    testInfo.setTimeout(CHECK_OR_REPAIR_WORST_MS + 15_000)
    const env = loadE2EEnv()
    await checkOrRepairSecondSecret(env, requireSecondPassword(env), appRepairDeps(_electronPage))
    await requireMainIsSmoke(env)
  })

  test('change the password, then sign in with it', async ({page}, testInfo) => {
    testInfo.setTimeout(240_000 + 2 * CHECK_OR_REPAIR_WORST_MS)
    const env = loadE2EEnv()
    const {secondUser} = env
    requireSecondPassword(env)
    const next = await rotateSecondPassword(
      env,
      async pw =>
        asSecond(page, async () => {
          const {hasServerKeys} = await mainRpcAsSecond<{hasServerKeys: boolean}>('keybase.1.account.hasServerKeys', {sessionID: 0})
          if (hasServerKeys) throw new Error('the second account has a server-synced PGP key, which a password change would drop; refusing')
          await openAccountPage(page)
          await accountPage(page).getByText('Change password', {exact: true}).click()
          await expect(page.getByText('A password is required for you to sign out and sign back in.', {exact: true}), 'the change password modal').toBeVisible({
            timeout: 10_000,
          })
          await saveNewPassword(page, pw)
          await step(page, testInfo, 'password changed', {card: true})
        }),
      {...appRepairDeps(page), envFile: defaultEnvPath()}
    )
    await step(page, testInfo, 'stored secret survived the change')

    // sign out of the second account (which drops its stored secret) and in with the new password
    await asSecond(page, async () => {
      try {
        await navigateToSettings(page)
        await page.getByTestId(T.SETTINGS_ACCOUNT).getByText('Sign out', {exact: true}).click()
        await page.getByText('Just sign out', {exact: true}).locator('visible=true').click({timeout: 10_000})
        await expect(loginList(page)).toBeVisible({timeout: 30_000})
        await expect(loginPassword(page)).toBeVisible({timeout: 10_000})
        await step(page, testInfo, 'signed out, password asked')
        // no Playwright action or assertion while the field holds the password (see submitSecret)
        await submitSecret(page, loginPassword(page), next, secondUser)
        await step(page, testInfo, 'signed in with the new password')
      } catch (e) {
        if (!(await page.locator('.username').first().isVisible())) {
          await restoreToSmoke(page).catch((r: unknown) => {
            throw new AggregateError([e, r], `${String(e)}; and then signing the smoke account back in failed: ${String(r)}`)
          })
        }
        throw e
      }
    })
    await checkSecondSecretSurvives(loadE2EEnv())
    await requireMainIsSmoke(env)
  })
})
