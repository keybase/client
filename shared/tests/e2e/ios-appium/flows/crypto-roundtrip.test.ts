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
import {currentCallSeq, uiCallCount, waitForUiCall} from '../gate/recorder'
import {fieldLength} from '../gate/secret-input'
import {clearSecretOnScreen, markSecretOnScreen} from '../gate/secret-screen.ts'
import {step} from '../gate/step'
import {CRYPTO_TABS, type CryptoTab, closeCryptoOutput, cryptoOutputReads, leaveCryptoTab, openCrypto, openCryptoTab, pasteIntoCryptoField} from '../helpers/crypto'
import {el} from '../helpers/elements'
import {filesRowNamed, fillHiddenField, tapButton, typeInFilter} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, drawnLabels} from '../helpers/menus'
import {labelHas, labelParts} from '../gate/page-source-lib'
import {escapeToTabs} from '../helpers/navigate'
import {masked, tapHeaderAction} from '../helpers/teams'

const ENCRYPT = 'keybase.1.saltpack.saltpackEncryptString'
const DECRYPT = 'keybase.1.saltpack.saltpackDecryptString'
const SIGN = 'keybase.1.saltpack.saltpackSignString'
const VERIFY = 'keybase.1.saltpack.saltpackVerifyString'

const FOR_SOMEONE_ELSE = "This message was encrypted for someone else or for a key you don't have."
const FAILED_TO_DECRYPT = 'Failed to decrypt text.'

type Cli = (args: Array<string>) => Promise<string>

describe('crypto roundtrip', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   host      the host CLI 75 (the account check 15, the call 60);  second  the second peer's CLI
  //             105 (the peer 45, the call 60)
  //   crypto    openCrypto 115;  tab  openCryptoTab 29;  leave  leaveCryptoTab 24;  done
  //             closeCryptoOutput 22
  //   type      the marker set 30 (fillHiddenField: the field is inside its box's one element)
  //   paste     setPasteboard 50, pasteIntoCryptoField 24, its length 6 (5, one read 1), the
  //             overwrite 50 = 130
  //   run       seq 2, the tap 1, the call waited for 12, its count 2, the output screen 11 = 28
  //   copy      filler 50, the button 6, the pasteboard polled 10s overrun by one read 40, the
  //             overwrite 50 = 146
  //   output    the marker read 16 (15, one read 1);  signer  6 (5, one read 1);  banner  16, the
  //             output's absence 1
  //   mark      clearArmorShown 2
  //   recipient addSecondAsRecipient 94
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
  // the message; armorInField names the operation whose field holds one
  const ARMOR_SHOWN = 'a saltpack message on the crypto screens'
  let armorShown = false
  let armorInField: CryptoTab | undefined

  const filler = () => `e2e-${e2eRunId()}-pasteboard`

  // Bound: 50.
  const overwritePasteboard = async () => {
    if (!armorOnPasteboard) return
    await setPasteboard(filler())
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
      // the field is inside its box's one element: the box gone is the field gone
      check(!(await el(CRYPTO_TABS[armorInField].input).isExisting()), 'the field the message was pasted into is still drawn')
      armorInField = undefined
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

  // Worst case (s): escapeToTabs 30, the overwrite 50, clearArmorShown 2, removeMade 1 = 83.
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

  // Puts the marker into the open operation's field and reads it back. The field is inside its box's
  // one element, so it is not in the tree: set through its own onChange. Bound: 30.
  const typeMarker = async (marker: string, tab: CryptoTab) => fillHiddenField(T.CRYPTO_TEXT_INPUT, marker, `the ${tab} field`)

  // Taps the operation's run button, waits for its call to go out once and for its output modal.
  // Bound: 28.
  const runOperation = async (tab: CryptoTab, method: string) => {
    const seq = await currentCallSeq()
    await el(T.CRYPTO_RUN_BUTTON).click()
    await waitForUiCall(`the ${tab} call to go out`, seq, method)
    check((await uiCallCount(seq, method)) === 1, `the run button sent the ${tab} call more than once`)
    await expectScreen(`the ${tab} output`, CRYPTO_TABS[tab].output)
  }

  // Copies the output with its "Copy to clipboard" and takes it off the pasteboard, which holds
  // filler before, so a stale pasteboard cannot pass; it is compared in memory, and the pasteboard is
  // overwritten after. Bound: setPasteboard 50, tapButton 7 (6, its read 1), the pasteboard 40 (10s of
  // reads, overrun by one 30), the overwrite 50 = 147.
  const copyOutput = async (kind: ArmorKind) => {
    await setPasteboard(filler())
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
    await overwritePasteboard()
    return text
  }

  // Pastes `text` (a saltpack message) into the open operation's field from the pasteboard, as a
  // person does, with the mark on before the field holds it; the field's length is read inside the
  // app, and the pasteboard is overwritten after. Bound: 130.
  const pasteArmor = async (text: string, tab: CryptoTab) => {
    armorOnPasteboard = true
    await setPasteboard(text)
    armorInField = tab
    markArmorShown()
    await pasteIntoCryptoField(tab)
    await waitFor(
      'the pasted message in the field',
      async () => ((await fieldLength(T.CRYPTO_TEXT_INPUT)) === text.length ? true : undefined),
      {interval: 250, timeout: 5_000}
    )
    creditSurface('pasteboard')
    await overwritePasteboard()
  }

  // Waits for the output modal to draw `marker` as its text. The output is a selectable text, which
  // XCUITest does not expose (its element has no label or value, seen live), so the text the modal
  // renders is compared with the marker inside the app; the answer is a yes or no, never the text.
  // Bound: 16 (15, one read 1).
  const expectOutput = async (marker: string) =>
    waitFor('the output to read the marker', async () => ((await cryptoOutputReads(marker)) ? true : undefined), {
      interval: 500,
      timeout: 15_000,
    })

  // How many drawn texts read each of `names` as a label part, in one read, compared in memory.
  // Bound: one read 2.
  const namesDrawn = async (names: ReadonlyArray<string>) => {
    const counts = names.map(() => 0)
    for (const label of await drawnLabels()) {
      const parts = labelParts(label)
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
      async () => ((await drawnLabels()).some(label => labelHas(label, text)) ? true : undefined),
      {interval: 250, timeout: 15_000}
    )
    check(!(await el(T.CRYPTO_OUTPUT).isExisting()), 'the output modal draws an output with its error')
  }

  // Picks the second account, by its exact name, as the open encrypt screen's recipient. Bound: the
  // box 10 and its tap 1, the screen 11, typeInFilter 32, the row 16 (15, one drag 1) and its tap 1,
  // the header's Add 6, the screen 11, the name drawn 6 = 94.
  const addSecondAsRecipient = async () => {
    const {secondUser} = loadE2EAccounts()
    await el(T.CRYPTO_RECIPIENTS).waitForExist({timeout: 10_000})
    await el(T.CRYPTO_RECIPIENTS).click()
    await expectScreen('the recipients search', 'cryptoTeamBuilder')
    // the search is a SearchFilter: its field is not in the tree
    await typeInFilter(secondUser, "the recipients search's field")
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

  // The phone makes a saltpack message of `kind` with the operation `tab`: its screen opened, the second
  // account added as a recipient when `toSecond`, this run's marker `label` typed, the operation run,
  // its output copied and closed. Bound: crypto 115, tab 29, type 30, step 2, run 28, copy 147, done
  // 22, mark 2, step 2 = 377; with toSecond, the recipient 94 and step 2 more = 473.
  const phoneMakes = async (tab: CryptoTab, method: string, kind: ArmorKind, label: string, {toSecond = false} = {}) => {
    const marker = e2eMarker(label)
    await openCrypto()
    await openCryptoTab(tab)
    if (toSecond) {
      await addSecondAsRecipient()
      await step('The second account as the recipient')
    }
    await typeMarker(marker, tab)
    await step(`The marker typed to ${tab}${toSecond ? ' for both' : ''}`, {card: true})

    markArmorShown()
    await runOperation(tab, method)
    const armor = await copyOutput(kind)
    await closeCryptoOutput(tab)
    await clearArmorShown()
    await step(`The ${kind === 'SIGNED' ? 'signed message' : 'ciphertext'} copied and its output closed`)
    return {armor, marker}
  }

  // The phone reads `armor` (a saltpack message) with the operation `tab`: its screen opened, the
  // message pasted, the operation run and its output checked by `expectOutcome`, then closed and left.
  // Bound: crypto 115, tab 29, step 2, paste 130, run 28, done 22, leave 24, mark 2, step 2 = 354, plus
  // expectOutcome's.
  const phoneReads = async (tab: CryptoTab, method: string, armor: string, expectOutcome: () => Promise<void>, stepName: string) => {
    await openCrypto()
    await openCryptoTab(tab)
    await step(`The ${tab} screen`)

    await pasteArmor(armor, tab)
    await runOperation(tab, method)
    await expectOutcome()
    await closeCryptoOutput(tab)
    await leaveCryptoTab(tab)
    await clearArmorShown()
    await step(stepName, {card: true})
  }

  // -- the phone encrypts or signs, the host or the peer reads it --------------------------------

  it('text encrypted to self decrypts on the host to the marker', async function () {
    // worst case (s): phoneMakes 377, host 75, step 2 = 454
    this.timeout(470_000)
    const {armor, marker} = await phoneMakes('encrypt', ENCRYPT, 'ENCRYPTED', 'crypto-self')
    const plain = await readsBy(host, ['decrypt'], armor, 'to-self')
    check(plain === marker, "the host's decrypt of the phone's ciphertext is not the marker")
    await step('The host decrypted it to the marker')
  })

  it('text encrypted to the second account and self decrypts on the host', async function () {
    // worst case (s): phoneMakes 473, host 75, step 2 = 550
    this.timeout(570_000)
    const {armor, marker} = await phoneMakes('encrypt', ENCRYPT, 'ENCRYPTED', 'crypto-to-second', {toSecond: true})
    const bySelf = await readsBy(host, ['decrypt'], armor, 'to-second-self')
    check(bySelf === marker, "the host's decrypt of the phone's ciphertext is not the marker")
    await step('The host decrypted it to the marker')
  })

  // A known failure (known-failures.ts): the second peer's SaltpackDecrypt uses its per-user-key
  // keyring without syncing it, so once the account's key rolled on another device it cannot decrypt
  // a message to the newest key.
  it('text encrypted to the second account decrypts on its peer', async function () {
    // worst case (s): phoneMakes 473, second 105, step 2 = 580
    this.timeout(600_000)
    const {armor, marker} = await phoneMakes('encrypt', ENCRYPT, 'ENCRYPTED', 'crypto-peer', {toSecond: true})
    const bySecond = await readsBy(second, ['decrypt'], armor, 'to-second')
    check(bySecond === marker, "the second account's decrypt of the phone's ciphertext is not the marker")
    await step('The second account decrypted it to the marker')
  })

  it('signed text verifies on the host as the smoke account’s', async function () {
    // worst case (s): phoneMakes 377, host 75, step 2 = 454
    this.timeout(470_000)
    const {smokeUser} = loadE2EAccounts()
    const {armor, marker} = await phoneMakes('sign', SIGN, 'SIGNED', 'crypto-sign')
    // -S: the verify fails unless the smoke account signed it
    const verified = await readsBy(host, ['verify', '-S', smokeUser], armor, 'signed')
    check(verified === marker, "the host's verify of the phone's signed message is not the marker")
    await step('The host verified it as the smoke account’s')
  })

  // -- the second account's peer makes it, the phone reads it ---------------------------------------

  it('the second account’s ciphertext decrypts to the marker, signed by it', async function () {
    // worst case (s): second 105, phoneReads 354, output 16, signer 6 = 481
    this.timeout(500_000)
    const {smokeUser} = loadE2EAccounts()
    const marker = e2eMarker('crypto-from-second')
    const ciphertext = await madeBy(second, ['encrypt', '-m', marker, smokeUser], 'from-second', 'ENCRYPTED')
    await phoneReads(
      'decrypt',
      DECRYPT,
      ciphertext,
      async () => {
        await expectOutput(marker)
        await expectSignedBySecond()
      },
      'Decrypted to the marker, signed by the second account'
    )
  })

  it('the second account’s signed text verifies to the marker, signed by it', async function () {
    // worst case (s): second 105, phoneReads 354, output 16, signer 6 = 481
    this.timeout(500_000)
    const marker = e2eMarker('crypto-signed-by-second')
    const signed = await madeBy(second, ['sign', '-m', marker], 'signed-by-second', 'SIGNED')
    await phoneReads(
      'verify',
      VERIFY,
      signed,
      async () => {
        await expectOutput(marker)
        await expectSignedBySecond()
      },
      'Verified to the marker, signed by the second account'
    )
  })

  // -- what the phone refuses -----------------------------------------------------------------------

  // Text the second account encrypted for itself alone: no key of the smoke account opens it (the
  // service's decryption-key-not-found cause), which the app words for the reader.
  it('ciphertext for someone else says so', async function () {
    // worst case (s): second 105, phoneReads 354, banner 17 = 476
    this.timeout(500_000)
    const {secondUser} = loadE2EAccounts()
    const marker = e2eMarker('crypto-for-second')
    const ciphertext = await madeBy(second, ['encrypt', '-m', marker, secondUser], 'for-second', 'ENCRYPTED')
    await phoneReads(
      'decrypt',
      DECRYPT,
      ciphertext,
      async () => expectRefused(FOR_SOMEONE_ELSE, 'the encrypted-for-someone-else banner'),
      'Ciphertext for someone else refused'
    )
  })

  // A changed body character fails the stream with no cause the service names, so the app shows its
  // generic message.
  it('tampered ciphertext fails to decrypt', async function () {
    // worst case (s): host 75, phoneReads 354, banner 17 = 446
    this.timeout(470_000)
    const {smokeUser} = loadE2EAccounts()
    const marker = e2eMarker('crypto-tampered')
    const ciphertext = await madeBy(host, ['encrypt', '-m', marker, smokeUser], 'to-tamper', 'ENCRYPTED')
    const bad = tamper(ciphertext)
    check(bad !== ciphertext, 'the tampered ciphertext is unchanged')
    await phoneReads('decrypt', DECRYPT, bad, async () => expectRefused(FAILED_TO_DECRYPT, 'the failed-to-decrypt banner'), 'Tampered ciphertext refused')
  })
})
