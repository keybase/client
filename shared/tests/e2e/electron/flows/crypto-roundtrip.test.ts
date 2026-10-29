// Saltpack round-trips through the crypto tab: text and files encrypted, signed, saved and read
// back, by the smoke account and by the second account's peer. The app's "Encrypt/Decrypt/Sign/
// Verify to ..." folder picker is answered with this run's output folder; "Save as TXT" is written by
// the service into ~/Downloads under a name it picks, and that exact file is removed after.
import * as fs from 'fs'
import * as path from 'path'
import type {Locator, Page, TestInfo} from '@playwright/test'
import escapeRegExp from 'lodash/escapeRegExp'
import {test, expect, e2eMarker, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {downloadsDir, removeOwnDownload} from '@/tests/e2e/electron/helpers/downloads'
import {dropFiles} from '@/tests/e2e/electron/helpers/drop'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {navigateToCrypto} from '@/tests/e2e/electron/helpers/navigate'
import {clickUnoccluded} from '@/tests/e2e/electron/helpers/chat'
import {step} from '@/tests/e2e/electron/helpers/step'
import {CORPUS} from '@/tests/e2e/fixtures/corpus/corpus'
import {loadE2EAccounts, loadE2EEnv} from '@/tests/e2e/accounts/env'
import {ensurePeer} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

const corpusFile = (name: string) => {
  const entry = CORPUS.find(e => e.name === name)
  if (!entry) throw new Error(`the corpus has no ${name}`)
  return entry.file
}

// -- this run's output folder -----------------------------------------------------------------------

const outDir = () => `/tmp/kb-e2e/crypto-${e2eRunId()}`

const ensureOutDir = () => {
  const dir = outDir()
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  const st = fs.lstatSync(dir)
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error(`${dir} is not a plain folder`)
  return dir
}

// <outDir>/<name>, which must not be there yet: the service would write beside it under another name.
const freshOut = (name: string) => {
  if (name !== path.basename(name) || name.startsWith('.')) throw new Error(`not a plain file name: ${name}`)
  const p = path.join(ensureOutDir(), name)
  if (fs.existsSync(p)) throw new Error(`${p} is already there`)
  return p
}

// Deletes one output this test made: a plain file directly in the output folder. A file the test
// never got to make is not there, and that is fine.
const removeOwnOutput = (p: string) => {
  const st = fs.lstatSync(p, {throwIfNoEntry: false})
  if (!st) return
  if (!st.isFile() || st.isSymbolicLink()) throw new Error(`refusing to delete ${p}: not a plain file`)
  if (fs.realpathSync(path.dirname(p)) !== fs.realpathSync(outDir())) throw new Error(`refusing to delete ${p}: not in ${outDir()}`)
  fs.unlinkSync(p)
}

// cleanup steps for withCleanup: every file is tried, and the first failure is thrown
const removeAll = <A,>(items: ReadonlyArray<A>, remove: (a: A) => void) => () => {
  const failed: Array<unknown> = []
  for (const a of items) {
    try {
      remove(a)
    } catch (e) {
      failed.push(e)
    }
  }
  if (failed.length) throw failed[0]
}
const removeOutputs = (outputs: ReadonlyArray<string>) => removeAll(outputs, removeOwnOutput)
const removeDownloads = (saved: ReadonlyArray<{p: string; size: number}>) => removeAll(saved, s => removeOwnDownload(s.p, s.size))

test.afterAll(() => {
  const dir = outDir()
  const st = fs.lstatSync(dir, {throwIfNoEntry: false})
  if (!st) return
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error(`${dir} is not a plain folder`)
  // rmdir: fails when a test left a file behind
  fs.rmdirSync(dir)
})

// -- the crypto tab ---------------------------------------------------------------------------------

type Tab = 'encrypt' | 'decrypt' | 'sign' | 'verify'
const tabs = {
  decrypt: {box: T.CRYPTO_DECRYPT_INPUT, nav: T.CRYPTO_NAV_DECRYPT, run: 'Decrypt to ...', dropPrompt: 'Drop a file to decrypt'},
  encrypt: {box: T.CRYPTO_ENCRYPT_INPUT, nav: T.CRYPTO_NAV_ENCRYPT, run: 'Encrypt to ...', dropPrompt: 'Drop a file to encrypt'},
  sign: {box: T.CRYPTO_SIGN_INPUT, nav: T.CRYPTO_NAV_SIGN, run: 'Sign to ...', dropPrompt: 'Drop a file to sign'},
  verify: {box: T.CRYPTO_VERIFY_INPUT, nav: T.CRYPTO_NAV_VERIFY, run: 'Verify to ...', dropPrompt: 'Drop a file to verify'},
} as const

// The tabs stay mounted with their input and recipients across tests: each test clears what it
// meets and what it leaves.
const resetTab = async (box: Locator) => {
  const clear = box.getByText('Clear', {exact: true})
  if (await clear.isVisible()) await clear.click()
  await expect(clear).toHaveCount(0)
  const removeRecipients = box.locator('.icon-gen-iconfont-remove')
  if (await removeRecipients.isVisible()) await removeRecipients.click()
  await expect(removeRecipients).toHaveCount(0)
}

const openTab = async (page: Page, tab: Tab) => {
  await navigateToCrypto(page)
  await page.getByTestId(tabs[tab].nav).first().click()
  const box = page.getByTestId(tabs[tab].box).locator('visible=true').first()
  await expect(box).toBeVisible()
  await resetTab(box)
  return box
}

const textInput = (box: Locator) => box.getByRole('textbox').last()
const textOutput = (box: Locator) => box.getByTestId(T.CRYPTO_OUTPUT)

// Drops `file` into the tab and runs it to the output folder through the app's folder picker;
// returns the output path the app shows, once it is on disk.
const runFileTo = async (page: Page, box: Locator, tab: Tab, file: string, expected: string) => {
  // the tab takes no drop while a run is in flight: its overlay asks for the file once it does
  await dropFiles(page, box, [file], box.getByText(tabs[tab].dropPrompt, {exact: true}))
  await expect(box.getByText(file, {exact: true})).toBeVisible()
  await (await connectMainProcess()).stubOpenDialog([outDir()])
  await box.getByText(tabs[tab].run, {exact: true}).click()
  await expect(box.getByText(expected, {exact: true}), `the ${tab} output path`).toBeVisible({timeout: 30_000})
  expect(fs.existsSync(expected), `${expected} on disk`).toBe(true)
}

// "Save as TXT": the service writes the output to ~/Downloads/keybase_<random><suffix> and the app
// shows that path.
const saveAsTxt = async (box: Locator, suffix: string) => {
  await box.getByText('Save as TXT', {exact: true}).click()
  const shown = box.getByText(new RegExp(`^${escapeRegExp(downloadsDir)}/keybase_[^/]+${escapeRegExp(suffix)}$`))
  await expect(shown, 'the saved file path').toBeVisible({timeout: 15_000})
  return (await shown.innerText()).trim()
}

const expectSigner = async (box: Locator, signer: string, notSigner?: string) => {
  await expect(box.getByText(signer, {exact: true}), 'the signer').toBeVisible({timeout: 15_000})
  if (notSigner) await expect(box.getByText(notSigner, {exact: true})).toHaveCount(0)
}

const expectSameBytes = (got: string, want: string) => {
  expect(fs.readFileSync(got).equals(fs.readFileSync(want)), `${got} has the bytes of ${want}`).toBe(true)
}

const secondPeer = async () => ensurePeer('second', loadE2EEnv())

const cleanupTabs = (page: Page, list: ReadonlyArray<Tab>) =>
  list.map(tab => async () => {
    await page.getByTestId(tabs[tab].nav).first().click()
    await resetTab(page.getByTestId(tabs[tab].box).locator('visible=true').first())
  })

// -- text -------------------------------------------------------------------------------------------

test('text to self, decrypt, same text; saved ciphertext decrypts from its file', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const {smokeUser} = loadE2EAccounts()
  const text = e2eMarker('crypto-text')
  const saved: Array<{p: string; size: number}> = []
  const outputs: Array<string> = []
  await withCleanup(
    async () => {
      const enc = await openTab(page, 'encrypt')
      await textInput(enc).fill(text)
      await expect(textOutput(enc)).toContainText('BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE', {timeout: 15_000})
      const ciphertext = (await textOutput(enc).innerText()).trim()
      await step(page, testInfo, 'text encrypted to self')

      const dec = await openTab(page, 'decrypt')
      await textInput(dec).fill(ciphertext)
      await expect(textOutput(dec)).toHaveText(text, {timeout: 15_000})
      await expectSigner(dec, smokeUser)
      await step(page, testInfo, 'decrypted to the same text')

      await page.getByTestId(T.CRYPTO_NAV_ENCRYPT).first().click()
      const file = await saveAsTxt(enc, '.txt.encrypted.saltpack')
      saved.push({p: file, size: fs.statSync(file).size})
      // the service writes the armor with its closing newline; the shown text is trimmed
      expect(fs.readFileSync(file, 'utf8')).toBe(`${ciphertext}\n`)
      await step(page, testInfo, 'ciphertext saved to a file')

      await page.getByTestId(T.CRYPTO_NAV_DECRYPT).first().click()
      await resetTab(dec)
      const out = freshOut(path.basename(file, '.encrypted.saltpack'))
      outputs.push(out)
      await runFileTo(page, dec, 'decrypt', file, out)
      expect(fs.readFileSync(out, 'utf8')).toBe(text)
      await step(page, testInfo, 'saved file decrypted to the same text', {card: true})
    },
    [
      removeDownloads(saved),
      removeOutputs(outputs),
      ...cleanupTabs(page, ['encrypt', 'decrypt']),
    ]
  )
})

test('sign text, save, verify', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const {smokeUser} = loadE2EAccounts()
  const text = e2eMarker('crypto-sign')
  const saved: Array<{p: string; size: number}> = []
  const outputs: Array<string> = []
  await withCleanup(
    async () => {
      const sign = await openTab(page, 'sign')
      await textInput(sign).fill(text)
      await expect(textOutput(sign)).toContainText('BEGIN KEYBASE SALTPACK SIGNED MESSAGE', {timeout: 15_000})
      const signed = (await textOutput(sign).innerText()).trim()
      const file = await saveAsTxt(sign, '.txt.signed.saltpack')
      saved.push({p: file, size: fs.statSync(file).size})
      expect(fs.readFileSync(file, 'utf8')).toBe(`${signed}\n`)
      await step(page, testInfo, 'signed message saved to a file')

      const verify = await openTab(page, 'verify')
      const out = freshOut(path.basename(file, '.signed.saltpack'))
      outputs.push(out)
      await runFileTo(page, verify, 'verify', file, out)
      expect(fs.readFileSync(out, 'utf8')).toBe(text)
      await expectSigner(verify, smokeUser)
      await step(page, testInfo, 'saved file verified, signed by smoke', {card: true})
    },
    [
      removeDownloads(saved),
      removeOutputs(outputs),
      ...cleanupTabs(page, ['sign', 'verify']),
    ]
  )
})

// -- files ------------------------------------------------------------------------------------------

const addRecipient = async (page: Page, box: Locator, username: string) => {
  await box.getByTestId(T.CRYPTO_RECIPIENTS).click()
  const search = page.getByPlaceholder(/^Search/).locator('visible=true').last()
  await expect(search).toBeVisible({timeout: 10_000})
  await search.fill(username)
  const result = page.getByTestId(T.TEAM_BUILDING_RESULT_ROW).filter({has: page.getByText(username, {exact: true})}).first()
  await expect(result, `${username} in the people search`).toBeVisible({timeout: 15_000})
  await clickUnoccluded(result)
  await page.getByText('Add', {exact: true}).locator('visible=true').last().click()
  await expect(box.getByText(username, {exact: true}), 'the recipient').toBeVisible({timeout: 10_000})
}

for (const name of ['e2e-c.pdf', 'e2e c ünïcode.txt', 'e2e-c-empty.txt']) {
  test(`encrypt file to second and self, decrypt: ${name}`, async ({page}, testInfo) => {
    test.setTimeout(150_000)
    const {secondUser, smokeUser} = loadE2EAccounts()
    const file = corpusFile(name)
    const outputs: Array<string> = []
    await withCleanup(
      async () => {
        const enc = await openTab(page, 'encrypt')
        await addRecipient(page, enc, secondUser)
        await step(page, testInfo, 'second as recipient')
        const encrypted = freshOut(`${name}.encrypted.saltpack`)
        outputs.push(encrypted)
        await runFileTo(page, enc, 'encrypt', file, encrypted)
        await step(page, testInfo, 'file encrypted')

        // the second account can read it too
        const bySecond = freshOut(`${name}.by-second`)
        outputs.push(bySecond)
        await (await secondPeer()).cli(['decrypt', '-i', encrypted, '-o', bySecond], 60_000)
        // the bytes second reads; an empty plaintext may leave no output file at all, which reads the same
        const read = fs.existsSync(bySecond) ? fs.readFileSync(bySecond) : Buffer.alloc(0)
        expect(read.equals(fs.readFileSync(file)), `what second decrypted from ${name}`).toBe(true)

        const dec = await openTab(page, 'decrypt')
        const decrypted = freshOut(name)
        outputs.push(decrypted)
        await runFileTo(page, dec, 'decrypt', encrypted, decrypted)
        expectSameBytes(decrypted, file)
        await expectSigner(dec, smokeUser)
        await step(page, testInfo, 'decrypted to the same bytes', {card: true})
      },
      [removeOutputs(outputs), ...cleanupTabs(page, ['encrypt', 'decrypt'])]
    )
  })

  test(`sign a file, verify: ${name}`, async ({page}, testInfo) => {
    test.setTimeout(120_000)
    const {smokeUser} = loadE2EAccounts()
    const file = corpusFile(name)
    const outputs: Array<string> = []
    await withCleanup(
      async () => {
        const sign = await openTab(page, 'sign')
        const signed = freshOut(`${name}.signed.saltpack`)
        outputs.push(signed)
        await runFileTo(page, sign, 'sign', file, signed)
        await step(page, testInfo, 'file signed')

        const verify = await openTab(page, 'verify')
        const verified = freshOut(name)
        outputs.push(verified)
        await runFileTo(page, verify, 'verify', signed, verified)
        expectSameBytes(verified, file)
        await expectSigner(verify, smokeUser)
        await step(page, testInfo, 'verified, signed by smoke', {card: true})
      },
      [removeOutputs(outputs), ...cleanupTabs(page, ['sign', 'verify'])]
    )
  })
}

test('encrypted by second decrypts', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const {secondUser, smokeUser} = loadE2EAccounts()
  const file = corpusFile('e2e-c.txt')
  const outputs: Array<string> = []
  await withCleanup(
    async () => {
      const encrypted = freshOut('e2e-c.txt.encrypted.saltpack')
      outputs.push(encrypted)
      await (await secondPeer()).cli(['encrypt', '-i', file, '-o', encrypted, smokeUser], 60_000)

      const dec = await openTab(page, 'decrypt')
      const decrypted = freshOut('e2e-c.txt')
      outputs.push(decrypted)
      await runFileTo(page, dec, 'decrypt', encrypted, decrypted)
      expectSameBytes(decrypted, file)
      await expectSigner(dec, secondUser, smokeUser)
      await step(page, testInfo, 'decrypted, sent by second', {card: true})
    },
    [removeOutputs(outputs), ...cleanupTabs(page, ['decrypt'])]
  )
})

// -- error paths ------------------------------------------------------------------------------------

// One character of the armored body changed to another of its alphabet.
const tamper = (armored: string) => {
  const start = armored.indexOf('. ') + 2
  const end = armored.lastIndexOf('. END')
  const at = Math.floor((start + end) / 2)
  const i = [...armored.slice(at)].findIndex(c => /[0-9A-Za-z]/.test(c)) + at
  const c = armored.charAt(i)
  return armored.slice(0, i) + (c === 'a' ? 'b' : 'a') + armored.slice(i + 1)
}

// Text second encrypted for itself alone: the service says no key of this account can open it
// (cause code 924, decryption key not found), which the app words for the reader. Known to fail on
// master (see known-failures.ts).
test('text encrypted for someone else says so', async ({page}, testInfo) => {
  const {secondUser} = loadE2EAccounts()
  const text = e2eMarker('crypto-other')
  await withCleanup(
    async () => {
      const ciphertext = (await (await secondPeer()).cli(['encrypt', '-m', text, secondUser], 60_000)).trim()
      expect(ciphertext).toContain('BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE')
      const dec = await openTab(page, 'decrypt')
      await textInput(dec).fill(ciphertext)
      await expect(textOutput(dec)).toHaveCount(0)
      await step(page, testInfo, 'ciphertext for someone else refused', {card: true})
      await expect(dec.getByText("This message was encrypted for someone else or for a key you don't have.", {exact: true})).toBeVisible({timeout: 15_000})
    },
    cleanupTabs(page, ['decrypt'])
  )
})

// A changed body character fails the stream with no cause the service names (DecryptionError with
// cause code 0, go/libkb/saltpack_dec.go), so the app shows its generic message: what is checked is
// that the text is refused and no plaintext shows.
test('bad ciphertext shows the decrypt error', async ({page}, testInfo) => {
  const text = e2eMarker('crypto-bad')
  await withCleanup(
    async () => {
      const enc = await openTab(page, 'encrypt')
      await textInput(enc).fill(text)
      await expect(textOutput(enc)).toContainText('BEGIN KEYBASE SALTPACK ENCRYPTED MESSAGE', {timeout: 15_000})
      const ciphertext = (await textOutput(enc).innerText()).trim()
      const bad = tamper(ciphertext)
      expect(bad).not.toBe(ciphertext)

      const dec = await openTab(page, 'decrypt')
      await textInput(dec).fill(bad)
      await expect(dec.getByText('Failed to decrypt text.', {exact: true})).toBeVisible({timeout: 15_000})
      await expect(textOutput(dec)).toHaveCount(0)
      await step(page, testInfo, 'tampered ciphertext refused', {card: true})
    },
    cleanupTabs(page, ['encrypt', 'decrypt'])
  )
})

test('signed by second shows second, not smoke', async ({page}, testInfo: TestInfo) => {
  const {secondUser, smokeUser} = loadE2EAccounts()
  const text = e2eMarker('crypto-second')
  await withCleanup(
    async () => {
      const signed = await (await secondPeer()).cli(['sign', '-m', text], 60_000)
      expect(signed).toContain('BEGIN KEYBASE SALTPACK SIGNED MESSAGE')

      const verify = await openTab(page, 'verify')
      await textInput(verify).fill(signed)
      await expect(textOutput(verify)).toHaveText(text, {timeout: 15_000})
      await expectSigner(verify, secondUser, smokeUser)
      await step(page, testInfo, 'verified, signed by second', {card: true})
    },
    cleanupTabs(page, ['verify'])
  )
})
