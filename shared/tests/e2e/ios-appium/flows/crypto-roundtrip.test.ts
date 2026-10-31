// Text saltpack on the phone, one case per test, each read back off the phone: what the phone
// encrypts or signs is copied with the output's "Copy to clipboard", taken off the pasteboard and
// decrypted or verified by the host CLI (the smoke account) or the second account's peer; what the
// second account's peer (or the host) makes is pasted into the phone, which must show this run's
// marker, signed by the second account, or the error the case expects. The phone's crypto takes text
// only (no browse, no Save as TXT), so no file case runs here.
//
// The plaintext is always this run's marker. A saltpack message is never in a step, a log, an error
// or a selector: the secret-on-screen mark is on from just before one shows (the encrypt or sign
// output, or a field it was pasted into) until the screen no longer draws it, so no step runs and no
// failure screenshot is taken then; outputs are compared in memory; the pasteboard is overwritten
// with filler once read or pasted from; a message reaches a CLI as a 0600 file in this run's folder,
// and one a CLI makes is written to one (crypto-lib.ts), and the flow's afterEach deletes them, puts
// the pasteboard back to filler and clears the mark once the crypto screens are gone. A pasted
// field's length is read inside the app, so no WebDriver answer carries its text.
import {randomBytes} from 'crypto'
import {loadE2EAccounts, loadE2EEnv} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {ensurePeer, requireMainIsSmoke, runKeybase} from '../../shared/peer-service'
import {e2eMarker, e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {requireSecondNotBlocked} from '../gate/blocks'
import {
  type ArmorKind,
  armorKind,
  cryptoDir,
  freshPath,
  readOwnFile,
  removeCryptoDir,
  removeOwnFile,
  tamper,
  withoutArmor,
  writeOwnFile,
} from '../gate/crypto-lib.ts'
import {pasteboardText, setPasteboard} from '../gate/device'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import type {CallMark} from '../gate/recorder-lib'
import {fieldLength} from '../gate/secret-input'
import {clearSecretOnScreen, markSecretOnScreen} from '../gate/secret-screen.ts'
import {step} from '../gate/step'
import {CRYPTO_TABS, type CryptoTab, closeCryptoOutput, leaveCryptoTab, openCrypto, openCryptoTab} from '../helpers/crypto'
import {el, pasteInto} from '../helpers/elements'
import {expectScreen, fillField, filesRowNamed, tapButton} from '../helpers/files'
import {waitFor} from '../helpers/lifecycle'
import {check} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {masked, onlyField, tapHeaderAction, TEXTS} from '../helpers/teams'

const ENCRYPT = 'keybase.1.saltpack.saltpackEncryptString'
const DECRYPT = 'keybase.1.saltpack.saltpackDecryptString'
const SIGN = 'keybase.1.saltpack.saltpackSignString'
const VERIFY = 'keybase.1.saltpack.saltpackVerifyString'

const FOR_SOMEONE_ELSE = "This message was encrypted for someone else or for a key you don't have."
const FAILED_TO_DECRYPT = 'Failed to decrypt text.'

// what the output modal draws its text as: a text, a selectable text's view, or a box merging it
const OUTPUT_TEXTS =
  '-ios predicate string:type == "XCUIElementTypeStaticText" OR type == "XCUIElementTypeTextView" OR type == "XCUIElementTypeOther"'

const labelParts = (label: string | null) =>
  (label ?? '')
    .replace(/\u00a0/g, ' ')
    .split(', ')
    .map(p => p.trim())

type Cli = (args: Array<string>) => Promise<string>

describe('crypto roundtrip', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   host      the host CLI 75 (the account check 15, the call 60);  second  the second peer's CLI
  //             105 (the peer 45, the call 60)
  //   crypto    openCrypto 86;  tab  openCryptoTab 29;  leave  leaveCryptoTab 24;  done
  //             closeCryptoOutput 22
  //   type      the marker typed 26 (fillField: the field 10, the typing 15, the read 1)
  //   paste     setPasteboard 30, the field 10, pasteInto 21, its length 6 (5, one read 1), the
  //             overwrite 30 = 97
  //   run       seq 2, the tap 1, the call waited for 12, its count 2, the output screen 11 = 28
  //   copy      filler 30, the button 6, the pasteboard polled 10s overrun by one read 40, the
  //             overwrite 30 = 106
  //   output    the marker read 16 (15, one read 1);  signer  6 (5, one read 1);  banner  16, the
  //             output's absence 1
  //   mark      clearArmorShown 2
  //   recipient addSecondAsRecipient 99
  //   step      2 (its 1s settle and the attach)

  before(async function () {
    // the second account is a recipient and a sender: a failed chat-blocks restore refuses here. The
    // host read 75s.
    this.timeout(90_000)
    await masked(async () => requireSecondNotBlocked())
  })

  // -- what the afterEach puts back ---------------------------------------------------------------

  const dir = () => cryptoDir(e2eRunId())
  // every file a test may have made in this run's folder, added before anything writes it
  const made = new Set<string>()
  // set before a saltpack message goes on the pasteboard (or the app copies one), cleared once
  // filler replaced it
  let armorOnPasteboard = false
  // set with the gate's secret-on-screen mark of this label, cleared once the screen no longer draws
  // the message; armorInField when an operation's field holds one
  const ARMOR_SHOWN = 'a saltpack message on the crypto screens'
  let armorShown = false
  let armorInField = false

  const filler = () => `e2e-${e2eRunId()}-pasteboard`

  // Bound: 30.
  const overwritePasteboard = () => {
    if (!armorOnPasteboard) return
    setPasteboard(filler())
    armorOnPasteboard = false
  }

  const markArmorShown = () => {
    armorShown = true
    markSecretOnScreen(ARMOR_SHOWN)
  }

  // Clears the mark once the output modal is not drawn, nor the field a message was pasted into; a
  // screen still drawing one keeps it. Bound: two reads 2.
  const clearArmorShown = async () => {
    if (!armorShown) return
    check(!(await el(T.CRYPTO_OUTPUT).isExisting()), 'the crypto output is still drawn')
    if (armorInField) {
      check(!(await el(T.CRYPTO_TEXT_INPUT).isExisting()), 'the field the message was pasted into is still drawn')
      armorInField = false
    }
    armorShown = false
    clearSecretOnScreen(ARMOR_SHOWN)
  }

  // Deletes every file of the test; each is tried, and the first failure is thrown. Bound: 1.
  const removeMade = () => {
    const failed: Array<unknown> = []
    for (const p of [...made]) {
      try {
        removeOwnFile(dir(), p)
        made.delete(p)
      } catch (e) {
        failed.push(e)
      }
    }
    if (failed.length) throw failed[0]
  }

  // Worst case (s): escapeToTabs 30, the overwrite 30, clearArmorShown 2, removeMade 1 = 63.
  afterEach(async function () {
    this.timeout(90_000)
    await withCleanup(escapeToTabs, [overwritePasteboard, clearArmorShown, removeMade])
  })

  // rmdir: fails when a test left a file behind
  after(() => {
    removeCryptoDir(dir())
  })

  // -- the host and the second peer ---------------------------------------------------------------

  // Runs `f`; an error it throws names no account and holds no saltpack text.
  const scrubbed = async <R,>(f: () => Promise<R>): Promise<R> => {
    try {
      return await masked(f)
    } catch (e) {
      if (isAttemptOver(e)) throw e
      // no cause: the original message may hold the text
      // eslint-disable-next-line preserve-caught-error
      throw new Error(withoutArmor(e instanceof Error ? e.message : String(e)))
    }
  }

  // The host's keybase CLI, on the smoke account. Bound: 75.
  const host: Cli = async args =>
    scrubbed(async () => {
      await requireMainIsSmoke(loadE2EEnv())
      return runKeybase(args, {timeoutMs: 60_000})
    })

  // The second account's peer's keybase CLI. Bound: 105.
  const second: Cli = async args => scrubbed(async () => (await ensurePeer('second', loadE2EEnv())).cli(args, 60_000))

  // A new path in this run's folder, held for the afterEach before anything writes it.
  const newPath = (label: string) => {
    const p = freshPath(dir(), `${label}-${randomBytes(4).toString('hex')}.saltpack`)
    made.add(p)
    return p
  }

  // What `cli`'s `<command> -i <file>` prints for `text`, written to a new 0600 file first. Bound:
  // the CLI's.
  const readsBy = async (cli: Cli, command: Array<string>, text: string, label: string) => {
    const p = newPath(label)
    writeOwnFile(p, text)
    return cli([...command, '-i', p])
  }

  // The saltpack message `cli` makes with `args` into a new file (`-o`), checked to be one armored
  // message of `kind`. Bound: the CLI's.
  const madeBy = async (cli: Cli, args: Array<string>, label: string, kind: ArmorKind) => {
    const p = newPath(label)
    await cli([...args, '-o', p])
    const text = readOwnFile(dir(), p).trim()
    check(armorKind(text) === kind, `what the CLI made for ${label} is not one ${kind.toLowerCase()} saltpack message`)
    return text
  }

  // -- the phone ----------------------------------------------------------------------------------

  const countOf = async (seq: CallMark, method: string) => (await uiCallsSince(seq, method)).length

  // Types the marker into the open operation's field and reads it back. Bound: 26.
  const typeMarker = async (marker: string, tab: CryptoTab) => fillField(() => el(T.CRYPTO_TEXT_INPUT), marker, `the ${tab} field`)

  // Taps the operation's run button, waits for its call to go out once and for its output modal.
  // Bound: 28.
  const runOperation = async (tab: CryptoTab, method: string) => {
    const seq = await currentCallSeq()
    await el(T.CRYPTO_RUN_BUTTON).click()
    await waitForUiCall(`the ${tab} call to go out`, seq, method)
    check((await countOf(seq, method)) === 1, `the run button sent the ${tab} call more than once`)
    await expectScreen(`the ${tab} output`, CRYPTO_TABS[tab].output)
  }

  // Copies the output with its "Copy to clipboard" and takes it off the pasteboard, which holds
  // filler before, so a stale pasteboard cannot pass; it is compared in memory, and the pasteboard is
  // overwritten after. Bound: 106.
  const copyOutput = async (kind: ArmorKind) => {
    setPasteboard(filler())
    armorOnPasteboard = true
    await tapButton('Copy to clipboard', "the output's Copy to clipboard")
    const text = await waitFor(
      `the pasteboard to hold the ${kind.toLowerCase()} message`,
      async () => {
        const t = await pasteboardText()
        return armorKind(t) === kind ? t.trim() : undefined
      },
      {interval: 500, timeout: 10_000}
    )
    creditSurface('pasteboard')
    overwritePasteboard()
    return text
  }

  // Pastes `text` (a saltpack message) into the open operation's field from the pasteboard, as a
  // person does, with the mark on before the field holds it; the field's length is read inside the
  // app, and the pasteboard is overwritten after. Bound: 97.
  const pasteArmor = async (text: string) => {
    armorOnPasteboard = true
    setPasteboard(text)
    await el(T.CRYPTO_TEXT_INPUT).waitForExist({timeout: 10_000})
    armorInField = true
    markArmorShown()
    await pasteInto(T.CRYPTO_TEXT_INPUT)
    await waitFor(
      'the pasted message in the field',
      async () => ((await fieldLength(T.CRYPTO_TEXT_INPUT)) === text.length ? true : undefined),
      {interval: 250, timeout: 5_000}
    )
    creditSurface('pasteboard')
    overwritePasteboard()
  }

  // Waits for the output modal to draw `marker` as its text, compared in memory. Bound: 16.
  const expectOutput = async (marker: string) =>
    waitFor(
      'the output to read the marker',
      async () => {
        const out = el(T.CRYPTO_OUTPUT)
        if (!(await out.isExisting())) return undefined
        for (const e of [await out.getElement(), ...(await out.$$(OUTPUT_TEXTS).getElements())]) {
          const label = await e.getAttribute('label').catch(() => null)
          const value = await e.getAttribute('value').catch(() => null)
          if (label === marker || value === marker) return true
        }
        return undefined
      },
      {interval: 500, timeout: 15_000}
    )

  // How many drawn texts read each of `names` as a label part, in one read, compared in memory.
  // Bound: one read 1.
  const namesDrawn = async (names: ReadonlyArray<string>) => {
    const counts = names.map(() => 0)
    for (const e of await browser.$$(TEXTS).getElements()) {
      const parts = labelParts(await e.getAttribute('label').catch(() => null))
      names.forEach((n, i) => {
        if (parts.includes(n)) counts[i]!++
      })
    }
    return counts
  }

  // Waits for the output modal to name the second account as its signer, and not the smoke account
  // in the same read. Bound: 6.
  const expectSignedBySecond = async () => {
    const {secondUser, smokeUser} = loadE2EAccounts()
    const [, smoke] = await waitFor(
      'the second account named as the signer',
      async () => {
        const counts = await namesDrawn([secondUser, smokeUser])
        return counts[0]! > 0 ? counts : undefined
      },
      {interval: 250, timeout: 5_000}
    )
    check(smoke === 0, 'the output names the smoke account too')
  }

  // Waits for the output modal's banner to read `text` and checks it draws no output. Bound: 17.
  const expectRefused = async (text: string, what: string) => {
    await waitFor(
      what,
      async () => {
        for (const e of await browser.$$(TEXTS).getElements()) {
          if (labelParts(await e.getAttribute('label').catch(() => null)).includes(text)) return true
        }
        return undefined
      },
      {interval: 250, timeout: 15_000}
    )
    check(!(await el(T.CRYPTO_OUTPUT).isExisting()), 'the output modal draws an output with its error')
  }

  // Picks the second account, by its exact name, as the open encrypt screen's recipient. Bound: the
  // box 10 and its tap 1, the screen 11, the field 11, fill 26, the row 16 (15, one drag 1) and its
  // tap 1, the header's Add 6, the screen 11, the name drawn 6 = 99.
  const addSecondAsRecipient = async () => {
    const {secondUser} = loadE2EAccounts()
    await el(T.CRYPTO_RECIPIENTS).waitForExist({timeout: 10_000})
    await el(T.CRYPTO_RECIPIENTS).click()
    await expectScreen('the recipients search', 'cryptoTeamBuilder')
    await fillField(await onlyField('TextField', "the recipients search's field"), secondUser, "the recipients search's field")
    const row = await filesRowNamed(secondUser, 'the second account among the results', {
      testID: T.TEAM_BUILDING_RESULT_ROW,
      timeout: 15_000,
    })
    await row.e.click()
    await tapHeaderAction('Add', "the recipients search's Add")
    await expectScreen('the encrypt screen with its recipient', 'encryptTab', p => {
      const users = p['teamBuilderUsers']
      return Array.isArray(users) && users.length === 1 && (users[0] as {username?: unknown}).username === secondUser
    })
    await waitFor('the recipient drawn', async () => ((await namesDrawn([secondUser]))[0]! > 0 ? true : undefined), {
      interval: 250,
      timeout: 5_000,
    })
  }

  // -- the phone encrypts or signs, the host or the peer reads it --------------------------------

  it('text encrypted to self decrypts on the host to the marker', async function () {
    // worst case (s): crypto 86, tab 29, type 26, step 2, run 28, copy 106, done 22, mark 2, step 2,
    // host 75, step 2 = 380
    this.timeout(400_000)
    const marker = e2eMarker('crypto-self')
    await openCrypto()
    await openCryptoTab('encrypt')
    await typeMarker(marker, 'encrypt')
    await step('The marker typed to encrypt', {card: true})

    markArmorShown()
    await runOperation('encrypt', ENCRYPT)
    const ciphertext = await copyOutput('ENCRYPTED')
    await closeCryptoOutput('encrypt')
    await clearArmorShown()
    await step('The ciphertext copied and its output closed')

    const plain = await readsBy(host, ['decrypt'], ciphertext, 'to-self')
    check(plain === marker, "the host's decrypt of the phone's ciphertext is not the marker")
    await step('The host decrypted it to the marker')
  })

  it('text encrypted to the second account and self decrypts on its peer and the host', async function () {
    // worst case (s): crypto 86, tab 29, recipient 99, step 2, type 26, step 2, run 28, copy 106,
    // done 22, mark 2, step 2, second 105, host 75, step 2 = 586
    this.timeout(600_000)
    const marker = e2eMarker('crypto-to-second')
    await openCrypto()
    await openCryptoTab('encrypt')
    await addSecondAsRecipient()
    await step('The second account as the recipient')
    await typeMarker(marker, 'encrypt')
    await step('The marker typed to encrypt for both', {card: true})

    markArmorShown()
    await runOperation('encrypt', ENCRYPT)
    const ciphertext = await copyOutput('ENCRYPTED')
    await closeCryptoOutput('encrypt')
    await clearArmorShown()
    await step('The ciphertext copied and its output closed')

    const bySecond = await readsBy(second, ['decrypt'], ciphertext, 'to-second')
    check(bySecond === marker, "the second account's decrypt of the phone's ciphertext is not the marker")
    const bySelf = await readsBy(host, ['decrypt'], ciphertext, 'to-second-self')
    check(bySelf === marker, "the host's decrypt of the phone's ciphertext is not the marker")
    await step('The second account and the host decrypted it to the marker')
  })

  it('signed text verifies on the host as the smoke account’s', async function () {
    // worst case (s): crypto 86, tab 29, type 26, step 2, run 28, copy 106, done 22, mark 2, step 2,
    // host 75, step 2 = 380
    this.timeout(400_000)
    const {smokeUser} = loadE2EAccounts()
    const marker = e2eMarker('crypto-sign')
    await openCrypto()
    await openCryptoTab('sign')
    await typeMarker(marker, 'sign')
    await step('The marker typed to sign', {card: true})

    markArmorShown()
    await runOperation('sign', SIGN)
    const signed = await copyOutput('SIGNED')
    await closeCryptoOutput('sign')
    await clearArmorShown()
    await step('The signed message copied and its output closed')

    // -S: the verify fails unless the smoke account signed it
    const verified = await readsBy(host, ['verify', '-S', smokeUser], signed, 'signed')
    check(verified === marker, "the host's verify of the phone's signed message is not the marker")
    await step('The host verified it as the smoke account’s')
  })

  // -- the second account's peer makes it, the phone reads it ---------------------------------------

  it('the second account’s ciphertext decrypts to the marker, signed by it', async function () {
    // worst case (s): second 105, crypto 86, tab 29, step 2, paste 97, run 28, output 16, signer 6,
    // done 22, leave 24, mark 2, step 2 = 419
    this.timeout(440_000)
    const {smokeUser} = loadE2EAccounts()
    const marker = e2eMarker('crypto-from-second')
    const ciphertext = await madeBy(second, ['encrypt', '-m', marker, smokeUser], 'from-second', 'ENCRYPTED')
    await openCrypto()
    await openCryptoTab('decrypt')
    await step('The decrypt screen')

    await pasteArmor(ciphertext)
    await runOperation('decrypt', DECRYPT)
    await expectOutput(marker)
    await expectSignedBySecond()
    await closeCryptoOutput('decrypt')
    await leaveCryptoTab('decrypt')
    await clearArmorShown()
    await step('Decrypted to the marker, signed by the second account', {card: true})
  })

  it('the second account’s signed text verifies to the marker, signed by it', async function () {
    // worst case (s): second 105, crypto 86, tab 29, step 2, paste 97, run 28, output 16, signer 6,
    // done 22, leave 24, mark 2, step 2 = 419
    this.timeout(440_000)
    const marker = e2eMarker('crypto-signed-by-second')
    const signed = await madeBy(second, ['sign', '-m', marker], 'signed-by-second', 'SIGNED')
    await openCrypto()
    await openCryptoTab('verify')
    await step('The verify screen')

    await pasteArmor(signed)
    await runOperation('verify', VERIFY)
    await expectOutput(marker)
    await expectSignedBySecond()
    await closeCryptoOutput('verify')
    await leaveCryptoTab('verify')
    await clearArmorShown()
    await step('Verified to the marker, signed by the second account', {card: true})
  })

  // -- what the phone refuses -----------------------------------------------------------------------

  // Text the second account encrypted for itself alone: no key of the smoke account opens it (the
  // service's decryption-key-not-found cause), which the app words for the reader.
  it('ciphertext for someone else says so', async function () {
    // worst case (s): second 105, crypto 86, tab 29, step 2, paste 97, run 28, banner 17, done 22,
    // leave 24, mark 2, step 2 = 414
    this.timeout(440_000)
    const {secondUser} = loadE2EAccounts()
    const marker = e2eMarker('crypto-for-second')
    const ciphertext = await madeBy(second, ['encrypt', '-m', marker, secondUser], 'for-second', 'ENCRYPTED')
    await openCrypto()
    await openCryptoTab('decrypt')
    await step('The decrypt screen')

    await pasteArmor(ciphertext)
    await runOperation('decrypt', DECRYPT)
    await expectRefused(FOR_SOMEONE_ELSE, 'the encrypted-for-someone-else banner')
    await closeCryptoOutput('decrypt')
    await leaveCryptoTab('decrypt')
    await clearArmorShown()
    await step('Ciphertext for someone else refused', {card: true})
  })

  // A changed body character fails the stream with no cause the service names, so the app shows its
  // generic message.
  it('tampered ciphertext fails to decrypt', async function () {
    // worst case (s): host 75, crypto 86, tab 29, step 2, paste 97, run 28, banner 17, done 22,
    // leave 24, mark 2, step 2 = 384
    this.timeout(400_000)
    const {smokeUser} = loadE2EAccounts()
    const marker = e2eMarker('crypto-tampered')
    const ciphertext = await madeBy(host, ['encrypt', '-m', marker, smokeUser], 'to-tamper', 'ENCRYPTED')
    const bad = tamper(ciphertext)
    check(bad !== ciphertext, 'the tampered ciphertext is unchanged')
    await openCrypto()
    await openCryptoTab('decrypt')
    await step('The decrypt screen')

    await pasteArmor(bad)
    await runOperation('decrypt', DECRYPT)
    await expectRefused(FAILED_TO_DECRYPT, 'the failed-to-decrypt banner')
    await closeCryptoOutput('decrypt')
    await leaveCryptoTab('decrypt')
    await clearArmorShown()
    await step('Tampered ciphertext refused', {card: true})
  })
})
