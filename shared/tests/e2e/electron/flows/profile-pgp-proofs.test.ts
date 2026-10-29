// A PGP key, a bitcoin address and a website proof, each added from the second account's own
// profile and taken off again (the smoke account's sigchain is left alone). The PGP key's private
// half is never uploaded, the bitcoin address is a burn address, and the website proof stops at its
// instructions, so nothing is posted anywhere outside Keybase. Each test then finds what it made,
// by the exact values it used, in the server's view of the second account and removes it through
// the second peer if the app did not.
import type {Locator, Page} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import {loadE2EAccounts, loadE2EEnv} from '@/tests/e2e/accounts/env'
import {asSecond, RESTORE_WORST_MS, restoreToSmoke} from '@/tests/e2e/electron/helpers/accounts'
import {clickUnoccluded} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {e2eRunId, expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {visibleProfile} from '@/tests/e2e/electron/helpers/people'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import {checkMarkShown, modalButton, modalRoot, readBack} from '@/tests/e2e/electron/helpers/teams'
import {mainRpcAsSecond} from '@/tests/e2e/shared/main-rpc'
import {ensurePeer} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

test.describe.configure({mode: 'serial'})
test.use({actionTimeout: 10_000})
test.afterEach(async ({page}, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + RESTORE_WORST_MS)
  await restoreToSmoke(page)
})

// a burn address: provably unspendable
const BURN_ADDRESS = '1BitcoinEaterAddressDontSendf59kuE'

const secondCli = async (args: Array<string>, timeoutMs = 60_000) => (await ensurePeer('second', loadE2EEnv())).cli(args, timeoutMs)

type Lookup = {
  them?: {
    id?: string
    cryptocurrency_addresses?: {bitcoin?: Array<{address: string; sig_id: string}>} | null
  }
}

// The second account as the server has it, through the second peer (a read, whatever the app is on).
const secondLookup = async (): Promise<NonNullable<Lookup['them']>> => {
  const {secondUser} = loadE2EAccounts()
  const out = await readBack(async () =>
    secondCli(['apicall', '-m', 'GET', 'user/lookup', '-a', `username=${secondUser}`, '-a', 'fields=cryptocurrency_addresses'])
  )
  const them = (JSON.parse(out) as Lookup).them
  if (!them) throw new Error('user/lookup returned nothing for the second account')
  return them
}

const btcSigIDs = async () =>
  ((await secondLookup()).cryptocurrency_addresses?.bitcoin ?? []).filter(a => a.address === BURN_ADDRESS).map(a => a.sig_id)

// The second account's live DNS proofs of `domain`, from its sigchain: the server's proof summary
// leaves out a proof it has not yet found.
const webSigIDs = async (domain: string) => {
  const out = await readBack(async () => secondCli(['sigs', 'list', '-j']))
  const sigs = JSON.parse(out) as Array<{sig_id: string; type: string; revoked: boolean; statement: string}>
  return sigs.filter(s => s.type === 'proof' && !s.revoked && s.statement === `dns://${domain}`).map(s => s.sig_id)
}

// The second account's active PGP keys, from `keybase pgp list`: a block per key, its "Keybase Key
// ID" line first.
const pgpKeys = async () => {
  const out = await readBack(async () => secondCli(['pgp', 'list']))
  return out
    .split(/\n(?=Keybase Key ID:)/)
    .filter(block => block.includes('Keybase Key ID:'))
    .map(block => ({block, id: /Keybase Key ID:\s*(\S+)/.exec(block)?.[1] ?? ''}))
}

// those whose identity carries `email`
const pgpKeyIDs = async (email: string) => (await pgpKeys()).filter(k => k.block.includes(`<${email}>`)).map(k => k.id)

// Fails naming every key unless the second account has exactly one PGP key, carrying `email`.
const requireOnlyKey = async (email: string) => {
  const keys = await pgpKeys()
  const strays = keys.filter(k => !k.block.includes(`<${email}>`))
  if (keys.length !== 1 || strays.length) {
    throw new Error(
      `the second account should have exactly one PGP key, this run's (<${email}>), but has ${keys.length}: ${keys.map(k => k.block.trim().replace(/\s+/g, ' ')).join(' | ')}`
    )
  }
}

// An identity a run of this file gives a key it generates.
const stampedPgpEmail = /^e2e-[0-9a-z]{5}[0-9]-pgp@example\.com$/
// pgpPurge writes each local secret key, encrypted to the account, into the service's config dir:
// the directory of its config file, as the service reports it (a file anywhere else is refused).
const mainConfigDir = async () => {
  const {configPath} = await mainRpcAsSecond<{configPath: string}>('keybase.1.config.getConfig', {sessionID: 0})
  if (!configPath || !path.isAbsolute(configPath)) throw new Error(`the main service reports no absolute config path (${configPath})`)
  return path.dirname(path.resolve(configPath))
}
const purgeFileName = /^kb-\d{4}-([0-9a-f]{40})\.saltpack$/

// The fingerprint in a file pgpPurge wrote into `dir`; throws for any other path.
const purgeFileFingerprint = (file: string, dir: string) => {
  const m = purgeFileName.exec(path.basename(file))
  if (path.dirname(path.resolve(file)) !== dir || !m?.[1]) {
    throw new Error(`refusing to touch ${file}: not a pgpPurge export in ${dir}`)
  }
  return m[1]
}

// Deletes exactly the files pgpPurge reported, each a plain file in the service's config dir. One
// that is refused or fails does not stop the others; every failure is thrown together after.
const removePurgeFiles = (files: ReadonlyArray<string>, dir: string) => {
  const errors: Array<Error> = []
  for (const file of files) {
    try {
      purgeFileFingerprint(file, dir)
      const st = fs.lstatSync(file)
      if (!st.isFile() || st.isSymbolicLink()) throw new Error(`refusing to delete ${file}: not a plain file`)
      fs.unlinkSync(file)
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)))
    }
  }
  const [first] = errors
  if (first && errors.length === 1) throw first
  if (errors.length > 1) throw new AggregateError(errors, errors.map(e => e.message).join('; '))
}

type PurgeRes = {filenames?: Array<string> | null}
const pgpPurge = async (doPurge: boolean) =>
  (await mainRpcAsSecond<PurgeRes>('keybase.1.pgp.pgpPurge', {doPurge, sessionID: 0})).filenames ?? []

type Upk = {
  current: {pgpKeys?: Record<string, {fingerprint: string | Uint8Array; identities?: Array<{email: string}> | null}> | null}
  pastIncarnations?: Array<Upk['current']> | null
}
const hex = (fp: string | Uint8Array) => (typeof fp === 'string' ? fp : Buffer.from(fp).toString('hex')).toLowerCase()

// Removes the local secret halves of the second account's generated PGP keys from the main
// service's keyring (dropping a key leaves them there). Only when every local key is one a run of
// this file generated (each identity an e2e-stamped example.com address); otherwise it fails
// naming the others and removes nothing.
const purgeLocalPgpKeys = async () => {
  // a dry run lists the local keys, writing each to a file it is deleted from at once
  const dir = await mainConfigDir()
  const listed = await pgpPurge(false)
  removePurgeFiles(listed, dir)
  const uid = (await secondLookup()).id
  if (!uid) throw new Error('user/lookup gave no uid for the second account')
  const upk = await mainRpcAsSecond<Upk>('keybase.1.user.loadUserPlusKeysV2', {oa: 0, pollForKID: '', sessionID: 0, uid})
  const identities = new Map<string, Array<string>>()
  for (const inc of [upk.current, ...(upk.pastIncarnations ?? [])]) {
    for (const k of Object.values(inc.pgpKeys ?? {})) identities.set(hex(k.fingerprint), (k.identities ?? []).map(i => i.email))
  }
  const others = listed
    .map(f => purgeFileFingerprint(f, dir))
    .filter(fp => {
      const emails = identities.get(fp) ?? []
      return !emails.length || !emails.every(e => stampedPgpEmail.test(e))
    })
  if (others.length) {
    throw new Error(`the second account's local keyring holds PGP keys no e2e run made (${others.map(fp => `${fp}: ${(identities.get(fp) ?? ['no identity']).join(', ')}`).join('; ')}); nothing purged`)
  }
  if (!listed.length) return
  removePurgeFiles(await pgpPurge(true), dir)
  expect(await pgpPurge(false), 'local PGP secret keys left after the purge').toEqual([])
}

// Revokes, through the second peer, each of `ids` the read says is still there, then reads back
// that none is.
const revokeLeft = async (what: string, read: () => Promise<Array<string>>, revoke: (id: string) => Array<string>) => {
  for (const id of await read()) await secondCli(revoke(id))
  await expect.poll(read, {message: `no ${what} left on the second account`, timeout: 60_000}).toEqual([])
}

// asSecond for a flow whose failure can leave a modal over the tab bar, which the switch back needs
const asSecondClosingModals = async (page: Page, f: () => Promise<void>) =>
  asSecond(page, async () => {
    try {
      await f()
    } catch (e) {
      await closeLeftoverModals(page)
      throw e
    }
  })

// The signed-in account's own profile, from the tab bar's user menu.
const openSelfProfile = async (page: Page) => {
  await navigateToPeople(page)
  const view = page.getByText('View/Edit profile', {exact: true})
  await openMenu(page, page.locator('.username').first(), view, 'the user menu')
  await view.click()
  await expect(visibleProfile(page)).toBeVisible({timeout: 10_000})
  await page.keyboard.press('Escape')
  await expect(view).toHaveCount(0, {timeout: 5_000})
}

// The proofs list from the profile's "Add more identities", filtered to one platform and picked.
const pickPlatform = async (page: Page, name: string) => {
  await visibleProfile(page).getByText('Add more identities', {exact: true}).click()
  const filter = modalRoot(page).getByPlaceholder(/Search \d+ platforms/)
  await expect(filter).toBeVisible({timeout: 10_000})
  await filter.fill(name)
  // the platforms arrive from the service (proofSuggestions) after the filter shows
  const entry = modalRoot(page).getByText(name, {exact: true}).first()
  await expect(entry, `the platform ${name} in the list`).toBeVisible({timeout: 30_000})
  await clickUnoccluded(entry)
}

// One of the profile's identity rows: its value, then its status icon, whose menu has Revoke or Drop.
const identityRow = (page: Page, value: string | RegExp): Locator =>
  visibleProfile(page).locator('.hover-container').filter({hasText: value}).first()

const revokeFromRow = async (page: Page, value: string | RegExp, action: 'Drop' | 'Revoke', confirm: string) => {
  const row = identityRow(page, value)
  const item = page.getByTestId(T.FLOATING_MENU).getByText(action, {exact: true})
  await openMenu(page, row.locator('.clickable-box2').last(), item, `the ${action} menu`)
  await item.click()
  await modalButton(page, confirm).click()
}

test('generate and remove a PGP key', async ({page}, testInfo) => {
  // a 4096-bit key can take a couple of minutes to generate
  test.setTimeout(420_000)
  const name = `e2e-${e2eRunId()}`
  const email = `e2e-${e2eRunId()}-pgp@example.com`
  await withCleanup(
    async () =>
      asSecondClosingModals(page, async () => {
        await openSelfProfile(page)
        await pickPlatform(page, 'PGP key')
        await clickUnoccluded(modalRoot(page).getByText('Get a new PGP key', {exact: true}))
        await modalRoot(page).getByPlaceholder('Your full name').fill(name)
        await modalRoot(page).getByPlaceholder('Email 1').fill(email)
        await step(page, testInfo, 'pgp info')
        await modalButton(page, 'Let the math begin').click()
        await expect(modalRoot(page).getByText('Here is your unique public key!', {exact: true})).toBeVisible({timeout: 300_000})
        // storing the private key on the server stays off
        const store = modalRoot(page)
          .locator('div')
          .filter({has: page.getByText("Store encrypted private key on Keybase's server", {exact: true})})
          .filter({has: page.locator('.icon-gen-iconfont-check')})
          .last()
        await expect(store).toBeVisible({timeout: 5_000})
        expect(await checkMarkShown(store.locator('.icon-gen-iconfont-check').first()), 'the store-on-server box').toBe(false)
        await step(page, testInfo, 'pgp key generated')
        await modalButton(page, 'Done').click()
        await expect.poll(async () => (await pgpKeyIDs(email)).length, {message: 'the new PGP key on the second account', timeout: 60_000}).toBe(1)
        await requireOnlyKey(email)
        await openSelfProfile(page)
        const row = identityRow(page, /@pgp/)
        await expect(row).toBeVisible({timeout: 30_000})
        await step(page, testInfo, 'profile shows the key', {card: true})
        await revokeFromRow(page, /@pgp/, 'Drop', 'Yes, drop it')
        await expect.poll(async () => pgpKeyIDs(email), {message: 'the PGP key dropped', timeout: 60_000}).toEqual([])
        await expect(row).toHaveCount(0, {timeout: 30_000})
        await step(page, testInfo, 'key gone')
        await purgeLocalPgpKeys()
      }),
    [
      async () => restoreToSmoke(page),
      async () => revokeLeft('PGP key of this run', async () => pgpKeyIDs(email), id => ['pgp', 'drop', id]),
      async () => closeLeftoverModals(page),
    ]
  )
})

test('add and revoke a bitcoin address', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  await withCleanup(
    async () =>
      asSecondClosingModals(page, async () => {
        await openSelfProfile(page)
        await pickPlatform(page, 'Bitcoin address')
        await modalRoot(page).getByPlaceholder('Your Bitcoin address').fill(BURN_ADDRESS)
        await step(page, testInfo, 'bitcoin address entered')
        await modalButton(page, 'Continue').click()
        await expect.poll(async () => (await btcSigIDs()).length, {message: 'the burn address on the second account', timeout: 60_000}).toBe(1)
        // the result screen's button closes the modal onto the profile
        await modalButton(page, 'Reload profile').click()
        const row = identityRow(page, BURN_ADDRESS)
        await expect(row).toBeVisible({timeout: 30_000})
        await step(page, testInfo, 'profile shows the address', {card: true})
        await revokeFromRow(page, BURN_ADDRESS, 'Revoke', 'Yes, revoke it')
        await expect.poll(btcSigIDs, {message: 'the burn address revoked', timeout: 60_000}).toEqual([])
        await expect(row).toHaveCount(0, {timeout: 30_000})
        await step(page, testInfo, 'address gone')
      }),
    [
      async () => restoreToSmoke(page),
      async () => revokeLeft('burn address', btcSigIDs, id => ['sigs', 'revoke', id]),
      async () => closeLeftoverModals(page),
    ]
  )
})

test('start a web proof to its edge', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const domain = `e2e${e2eRunId()}.example.com`
  await withCleanup(
    async () =>
      asSecondClosingModals(page, async () => {
        await openSelfProfile(page)
        await pickPlatform(page, 'Your own website')
        // A TXT-file proof first fetches the site (prechecks), which a reserved domain never answers;
        // a DNS proof checks its record only once the user says it is in place.
        await clickUnoccluded(modalRoot(page).getByText('Set a DNS', {exact: true}))
        const input = modalRoot(page).getByPlaceholder('yourdomain.com')
        await expect(input).toBeVisible({timeout: 30_000})
        await input.fill(domain)
        await modalButton(page, 'Continue').click()
        // the instructions: what to host on the site, which no test can put there
        await expect(modalRoot(page).getByText(/Enter the following as a TXT entry/).first()).toBeVisible({timeout: 30_000})
        await step(page, testInfo, 'proof instructions', {card: true})
        await manualEdge(page, testInfo, 'external-proofs')
        await modalButton(page, 'Cancel').click()
        await expect(modalRoot(page).getByText(/Enter the following as a TXT entry/)).toHaveCount(0, {timeout: 15_000})
        // the service posts the proof before it shows the instructions, so a pending one is left
        await expect.poll(async () => (await webSigIDs(domain)).length, {message: 'the pending web proof', timeout: 60_000}).toBe(1)
        await openSelfProfile(page)
        const row = identityRow(page, domain)
        await expect(row).toBeVisible({timeout: 30_000})
        await step(page, testInfo, 'profile shows the pending proof')
        await revokeFromRow(page, domain, 'Revoke', 'Yes, revoke it')
        await expect.poll(async () => webSigIDs(domain), {message: 'the web proof revoked', timeout: 60_000}).toEqual([])
        await expect(row).toHaveCount(0, {timeout: 30_000})
        await step(page, testInfo, 'proof gone')
      }),
    [
      async () => restoreToSmoke(page),
      async () => revokeLeft(`web proof for ${domain}`, async () => webSigIDs(domain), id => ['sigs', 'revoke', id]),
      async () => closeLeftoverModals(page),
    ]
  )
})
