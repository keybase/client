// The second account's own proofs, added and taken off from its profile on the phone (the smoke
// account's sigchain is left alone), one owned object per test: the bitcoin burn address, revoked
// from its row; a DNS proof for this run's reserved domain, left pending at its instructions (no
// record is ever published, and the proof is never checked: proving an identity on an external
// site is manual-only), then revoked; and a PGP key the second account's peer makes (the phone
// cannot make one), dropped from its row and then purged from the peer's keyring.
//
// Each proof's sig id is read back from the second account's sigchain right after its add's call goes
// out and recorded (recordProofSig). The add's kind and the sigchain's ids before it are held from
// before the tap, so a test that stopped between the add and its record still has the new sig of
// that kind recorded by the afterEach (none is fine there). The afterEach then revokes, through the second peer, only what
// this run added (revokeLeftovers, which also drops keys on this run's stamped PGP identity), purges
// a key this run made from the peer's keyring, and puts the app back on the smoke account. Every
// read through the peer is parse-anchored: the sig list holds the eldest link, the lookup the
// account's uid, the key list a live device key. A row's absence is read with the profile screen
// proven current and its "Add more identities" drawn.
//
// The proof text the DNS instructions show is a public sig: it is in the screenshot, never in a step
// name, an error or a log. "View proof", "I fixed it - recheck" and the instructions' check button are
// never pressed.
import {loadE2EAccounts} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {
  BURN_ADDRESS,
  cryptoAddresses,
  peerMakePgpKey,
  pgpList,
  purgePeerPgp,
  recordedSigCount,
  recordProofSig,
  revokeLeftovers,
  sigIDsBefore,
  sigsList,
  stampedPgpEmail,
} from '../../shared/profile'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {asSecond, restoreToSmoke} from '../gate/accounts'
import {requireSecondNotBlocked} from '../gate/blocks'
import {elementInRow, innermost, type Rect} from '../gate/chat-lib.ts'
import {sourceElements, sourceRect} from '../gate/page-source-lib'
import {currentCallSeq, uiCallCount, waitForUiCall} from '../gate/recorder'
import {manualEdge, retriedNavigation, step} from '../gate/step'
import {closeMessageMenu, dragUntilOnScreen} from '../helpers/chat'
import {el} from '../helpers/elements'
import {fillField, tapButton} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, elementWithLabelPartIn, openMenuFrom, press} from '../helpers/menus'
import {escapeToTabs, HEADER_CANCEL} from '../helpers/navigate'
import {ADD_IDENTITIES, openOwnProfileOf} from '../helpers/profile'
import {masked, onlyField, textPartShown, textShown} from '../helpers/teams'

const REGISTER = 'keybase.1.cryptocurrency.registerAddress'
const START_PROOF = 'keybase.1.prove.startProof'
const REVOKE_SIGS = 'keybase.1.revoke.revokeSigs'
const REVOKE_KEY = 'keybase.1.revoke.revokeKey'

const DNS_INSTRUCTIONS = '-ios predicate string:label BEGINSWITH "Enter the following as a TXT entry" AND visible == 1'
// what an identity row draws its value as: one text, its value then "@<type>"
const ROW_TYPES = ['XCUIElementTypeStaticText', 'XCUIElementTypeTextView', 'XCUIElementTypeOther']

type Params = Record<string, unknown>

// How an identity row's text reads, compared in memory only (a key's row shows the last 16 hex
// digits of its fingerprint in groups of four, which go into no selector or error).
type RowMatch = (text: string) => boolean
const rowReads = (value: string, type: string): RowMatch => {
  const want = `${value}@${type}`.toLowerCase()
  return text => text.toLowerCase() === want
}
const pgpRowReads = (fingerprint: string): RowMatch => {
  const last = fingerprint.slice(-16)
  return rowReads(`${last.slice(0, 4)} ${last.slice(4, 8)} ${last.slice(8, 12)} ${last.slice(12, 16)}`, 'pgp')
}

describe('profile proofs', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   peer      a read through the second peer 435 (readBack: four tries of the peer 45 and the call
  //             60, 5s apart);  keys  pgpList 500 (the lookup 435, the peer 45, its connect 10 and call
  //             10);  polled  60s of reads, overrun by one: of the peer 495, of the keys 560
  //   record    recordProofSig waited for 30s, overrun by one read 465
  //   keygen    peerMakePgpKey 365 (the peer 45, its connect 10, the keygen 300, the key check 10);
  //             purge  purgePeerPgp 540 (the peer 45, its connect 10, the config 10, three purges 30,
  //             and for a key it did not make the lookup 435 and the keys 10)
  //   second    asSecond 425 (the switch 150, restoreToSmoke 275)
  //   profile   openOwnProfile 63 (escapeToTabs 30, the link 1, screen 21, the page 11);  identities
  //             dragUntilOnScreen 20, its tap 1
  //   row       a row waited for 16 (15, one read 1), 31 with a 30s wait;  in row  elementInRow 2;
  //             gone  rowGone 57
  //   platform  the filter filled 26, the platform waited for 31 (30, one read 1) and its tap 1
  //   screen    a screen waited for 11 (10, read 1), 21 with a 20s wait;  button  tapButton 6, its tap
  //             1;  text  textShown 6, 16 with a 15s wait;  field  onlyField 11;  fill  fillField 26
  //   header    the header's Cancel 6 (5, its tap 1)
  //   menu      openMenuFrom 19;  item  chooseMenuItem 22
  //   calls     one read 2;  waited for  12 (10, one read 2)
  //   step      2 (its 1s settle and the attach)

  before(async function () {
    // proofs are added on the second account, and the follow flows ran before: a failed chat-blocks
    // restore refuses here. The host read 75s.
    this.timeout(90_000)
    await masked(async () => requireSecondNotBlocked())
  })

  // -- what the afterEach puts back ---------------------------------------------------------------

  // set before the peer starts making a PGP key, so a test that stopped during it still purges
  let pgpStarted = false
  // the key's fingerprint, once the peer made it
  let madeFingerprint: string | undefined

  // Removes from the second peer's keyring each key of this run, in one purge: the one made, and any
  // on this run's stamped identity the account lists (a keygen that stopped before it said its
  // fingerprint). Earlier runs' stamped keys go with it. Bound: the keys 500, the purge 540.
  const purgeMadeKeys = async () => {
    if (!pgpStarted) return
    await masked(async () => {
      const fps = new Set((await pgpList()).filter(k => k.emails.includes(stampedPgpEmail())).map(k => k.fingerprint))
      if (madeFingerprint) fps.add(madeFingerprint)
      await purgePeerPgp([...fps])
    })
    pgpStarted = false
    madeFingerprint = undefined
  }

  // the add a test is making: its kind and the sigchain's ids before it, set before the add's tap
  let pendingAdd: {before: ReadonlySet<string>; kind: 'bitcoin' | 'dns'} | undefined

  // Records the new sig of the pending add's kind, if the server has one: only a sig new since
  // `before` with that kind's statement, so it is revoked below. Bound: one read 435.
  const recordPending = async () => {
    if (!pendingAdd) return
    const {before, kind} = pendingAdd
    await masked(async () => recordProofSig(kind, before, {allowNone: true}))
    pendingAdd = undefined
  }

  // Bound: revokeLeftovers: the sigs 435, a revoke 435 per recorded sig, the keys 500, a drop 435,
  // then 60s of reads overrun by one 935 = 2305 and 435 a sig.
  const revokeRun = async () => masked(async () => revokeLeftovers())

  // A test records one sig, but an afterEach that failed before leaves its sigs recorded for the
  // next one; the bound counts each, up to 4 (a longer list goes on in the next afterEach).
  const MAX_SIGS = 4
  const PER_SIG = 435

  afterEach(async function () {
    // Worst case (s): close 19, recordPending 435, revokeRun 2305 and 435 a sig, purgeMadeKeys 1040,
    // restoreToSmoke 275, escapeToTabs 30 = 4104 and 435 a sig (at least one).
    const sigs = Math.min(MAX_SIGS, Math.max(1, recordedSigCount() + (pendingAdd ? 1 : 0)))
    this.timeout((4_104 + PER_SIG * sigs + 100) * 1_000)
    await withCleanup(closeMessageMenu, [recordPending, revokeRun, purgeMadeKeys, restoreToSmoke, escapeToTabs])
  })

  // -- reads --------------------------------------------------------------------------------------

  const onOwnProfile = (p: Params) => p['username'] === loadE2EAccounts().secondUser

  // The second account's own profile, while the app is on it. Bound: 63.
  const openOwnProfile = async () => openOwnProfileOf(loadE2EAccounts().secondUser, 'the second account')

  // Drags the profile until its "Add more identities" is on screen, which brings the identity rows
  // above it into view. Bound: 20.
  const revealIdentities = async () => dragUntilOnScreen('"Add more identities"', () => browser.$(ADD_IDENTITIES))

  // The rects of the texts on screen that `match` reads as the identity row's, innermost of nested
  // ones, read off one page source (an attribute call per text of the profile took longer than the
  // row's wait, seen live). Bound: one read 1.
  const rowTextRects = async (match: RowMatch) => {
    const rects: Array<Rect> = []
    for (const {attrs, type} of sourceElements(await browser.getPageSource())) {
      if (!ROW_TYPES.includes(type) || attrs['visible'] !== 'true') continue
      const label = (attrs['label'] ?? '').replace(/\u00a0/g, ' ')
      const value = (attrs['value'] ?? '').replace(/\u00a0/g, ' ')
      if (!match(label) && !match(value)) continue
      rects.push(sourceRect(attrs))
    }
    return innermost(rects).map(i => rects[i]!)
  }

  // The identity row `match` reads, once the profile draws it: the band across the screen its text
  // sits in, where its status icon (the row's menu) is drawn too. Bound: `timeout`, plus one read 1.
  const identityRow = async (match: RowMatch, what: string, timeout = 15_000): Promise<Rect> =>
    waitFor(
      what,
      async () => {
        const found = await rowTextRects(match)
        if (found.length > 1) throw new Error(`${found.length} of ${what} drawn, not one`)
        const [text] = found
        if (!text) return undefined
        const {width} = await browser.getWindowRect()
        return {height: text.height + 16, width, x: 0, y: text.y - 8}
      },
      {interval: 500, timeout}
    )

  // Opens the row's menu from its status icon and picks `item` ("Revoke", or "Drop" for a key), then
  // waits for the confirm screen. The row is read again with its icon, as the profile can still move
  // after the row was first read (seen live: the pending DNS row's icon was not in the band read
  // before the step's screenshot). Bound: 10s of row and icon reads, overrun by one (the row 4, the icon
  // 2) 6, menu 19, item 22, screen 11 = 68.
  const openRevoke = async (match: RowMatch, item: 'Drop' | 'Revoke', what: string) => {
    const icon = await waitFor(
      `${what}'s menu icon`,
      async () => elementInRow(await identityRow(match, what, 3_000), T.PROFILE_ASSERTION_MENU),
      {interval: 500, timeout: 10_000}
    )
    await openMenuFrom(`${what}'s menu`, async () => icon.click())
    await chooseMenuItem(item)
    await expectScreen(`${what}'s ${item} confirm`, 'profileRevoke')
  }

  // Waits until the profile, proven current and drawing its "Add more identities", no longer draws
  // the row `match` reads. Bound: screen 21, identities 20, then 15s of reads, overrun by one 1 = 57.
  const rowGone = async (match: RowMatch, what: string) => {
    await expectScreen("the second account's own profile", 'profile', onOwnProfile, 20_000)
    await revealIdentities()
    await waitFor(
      what,
      async () => {
        check(await browser.$(ADD_IDENTITIES).isExisting(), 'the profile does not draw its "Add more identities"')
        return (await rowTextRects(match)).length === 0 ? true : undefined
      },
      {interval: 500, timeout: 15_000}
    )
  }

  // Polls a read through the second peer until `ok` takes it. Bound: 60s, overrun by one read.
  const expectPeer = async <V,>(what: string, read: () => Promise<V>, ok: (v: V) => boolean) =>
    masked(async () =>
      waitFor(`the second peer to read ${what}`, async () => (ok(await read()) ? true : undefined), {interval: 2_000, timeout: 60_000})
    )

  // The sig the add made, recorded once the second account's sigchain lists it. Bound: 465.
  const recordAdded = async (kind: 'bitcoin' | 'dns', before: ReadonlySet<string>) =>
    masked(async () => waitFor(`the ${kind} proof on the second account's sigchain`, async () => recordProofSig(kind, before), {interval: 2_000, timeout: 30_000}))

  const sigRevoked = (sigID: string) => async () => (await sigsList()).find(s => s.sigID === sigID)

  // Opens the proofs list from the profile and picks the platform `name` after filtering for it.
  // Bound: identities 21, screen 11, fill 26, the platform 32 = 90.
  const pickPlatform = async (name: string) => {
    await revealIdentities()
    await browser.$(ADD_IDENTITIES).click()
    await expectScreen('the proofs list', 'profileProofsList')
    await fillField(() => el(T.PROFILE_PROOFS_FILTER), name, "the proofs list's filter")
    // the platforms arrive from the service after the list shows
    // the row's box, read off one page source (its text reads wider than the box, past the screen's
    // edge, so the two never nest; seen live); a row XCUITest reports visible=false is pressed at its
    // frame
    const entry = await waitFor(
      `the platform ${name} in the list`,
      async () => elementWithLabelPartIn(['XCUIElementTypeOther'], name, `the platform ${name}`, {forTap: true}),
      {interval: 500, timeout: 30_000}
    )
    await press(entry, `the platform ${name}`)
  }

  // Taps the confirm's `label` and waits for `method` to go out once. Bound: calls 2, button 7,
  // waited for 12, calls 2 = 23.
  const confirmRevoke = async (label: string, method: string) => {
    const seq = await currentCallSeq()
    await tapButton(label, `the confirm's ${label}`)
    await waitForUiCall(`the ${label} to go out`, seq, method)
    check((await uiCallCount(seq, method)) === 1, `the confirm sent ${method} more than once`)
  }

  it('add the bitcoin burn address and revoke it from its row', async function () {
    // worst case (s): the sigs 435, second 425; in it: profile 63, platform 90, field 11, fill 26,
    // step 2, calls 2, button 7, waited for 12, record 465, calls 2, text 16, polled 495, step 2,
    // button 7, screen 21, identities 20, row 16, step 2, revoke 68, step 2, confirm 23, polled 495,
    // the address read 435, gone 57, step 2 = 3201
    this.timeout(3_250_000)
    const before = await masked(async () => sigIDsBefore())
    pendingAdd = {before, kind: 'bitcoin'}
    const row = rowReads(BURN_ADDRESS, 'btc')

    await asSecond(async () => {
      await openOwnProfile()
      await pickPlatform('Bitcoin address')
      await fillField(await onlyField('TextField', 'the bitcoin address field'), BURN_ADDRESS, 'the bitcoin address field')
      await step('The burn address typed')
      const seq = await currentCallSeq()
      await tapButton('Continue', "the address screen's Continue")
      await waitForUiCall('the address to go out', seq, REGISTER)
      const sigID = await recordAdded('bitcoin', before)
      pendingAdd = undefined
      check((await uiCallCount(seq, REGISTER)) === 1, 'Continue sent the address more than once')
      await textShown('Verified!', 'the address added', 15_000)
      await expectPeer('the burn address', cryptoAddresses, as => as.some(a => a.address === BURN_ADDRESS && a.sigID === sigID))
      await step('The address added')

      await tapButton('Reload profile', "the result's Reload profile")
      await expectScreen("the second account's own profile", 'profile', onOwnProfile, 20_000)
      await revealIdentities()
      await identityRow(row, "the address's row")
      await step('The profile shows the address', {card: true})
      await openRevoke(row, 'Revoke', "the address's row")
      await step('The revoke confirm')
      await confirmRevoke('Yes, revoke it', REVOKE_SIGS)
      // the sig list holds the eldest link, else it throws: a failed read never reads as revoked
      await expectPeer('the burn address revoked', sigRevoked(sigID), s => !!s?.revoked)
      const addresses = await masked(async () => cryptoAddresses())
      check(!addresses.some(a => a.sigID === sigID), 'the lookup still lists the revoked address')
      await rowGone(row, "the address's row gone from the profile")
      await step('The address revoked')
    })
  })

  it('start a DNS proof to its instructions and revoke the pending proof from its row', async function () {
    // worst case (s): the sigs 435, second 425; in it: profile 63, platform 90, text 16,
    // calls 2, its press 2, waited for 12, field 11, fill 26, step 2, button 7, the instructions 31,
    // record 465, manual 2, header 6, screen 21, identities 20, row 31, step 2, revoke 68, step 2,
    // confirm 23, polled 495, gone 57, step 2 = 2316
    this.timeout(2_350_000)
    const domain = `e2e${e2eRunId()}.example.com`
    const before = await masked(async () => sigIDsBefore())
    pendingAdd = {before, kind: 'dns'}
    const row = rowReads(domain, 'dns')

    await asSecond(async () => {
      await openOwnProfile()
      await pickPlatform('Your own website')
      // A TXT-file proof first fetches the site, which a reserved domain never answers; a DNS proof
      // checks its record only when asked to, which this never does.
      // a choice row XCUITest can report visible=false: found among on-screen frames and pressed (a
      // frame tap when invisible)
      const dns = await textPartShown('Set a DNS', 'the website choice\'s "Set a DNS"', 15_000, {forTap: true})
      const seq = await currentCallSeq()
      await press(dns, 'the website choice\'s "Set a DNS"')
      await waitForUiCall('the proof to start', seq, START_PROOF)
      await fillField(await onlyField('TextField', 'the domain field'), domain, 'the domain field')
      await step('The domain typed')
      await tapButton('Continue', "the domain screen's Continue")
      // the instructions: what to put in the DNS zone, which no test can do
      await browser.$(DNS_INSTRUCTIONS).waitForExist({timeout: 30_000, timeoutMsg: 'the DNS instructions never showed'})
      // the service posts the proof before it shows the instructions, so a pending one is left
      const sigID = await recordAdded('dns', before)
      pendingAdd = undefined
      await manualEdge('external-proofs')

      await browser.$(HEADER_CANCEL).waitForExist({timeout: 5_000})
      await browser.$(HEADER_CANCEL).click()
      await expectScreen("the second account's own profile after the instructions closed", 'profile', onOwnProfile, 20_000)

      await revealIdentities()
      await identityRow(row, "the pending proof's row", 30_000)
      await step('The profile shows the pending proof', {card: true})
      await openRevoke(row, 'Revoke', "the pending proof's row")
      await step('The revoke confirm')
      await confirmRevoke('Yes, revoke it', REVOKE_SIGS)
      // the sig list holds the eldest link, else it throws: a failed read never reads as revoked
      await expectPeer('the pending proof revoked', sigRevoked(sigID), s => !!s?.revoked)
      await rowGone(row, "the pending proof's row gone from the profile")
      await step('The proof revoked')
    })
  })

  it('drop a PGP key the second account’s peer made from its row', async function () {
    // worst case (s): keygen 365, polled 560, second 425; in it: the row opened 159 (60s of tries,
    // overrun by one: profile 63, identities 20, row 16), step 2, revoke 68, step 2, confirm 23,
    // polled 560, gone 57, step 2; then purge 540 = 2763
    this.timeout(2_800_000)
    pgpStarted = true
    const fp = await masked(async () => peerMakePgpKey('drop'))
    madeFingerprint = fp
    const live = (keys: Awaited<ReturnType<typeof pgpList>>) => keys.some(k => k.fingerprint === fp && !k.revoked)
    await expectPeer('the new key on the second account', pgpList, live)
    const row = pgpRowReads(fp)

    await asSecond(async () => {
      // the profile shows a key made elsewhere once it loads the account afresh
      await retriedNavigation(
        "the key's row on the profile",
        async () => {
          await openOwnProfile()
          await revealIdentities()
          await identityRow(row, "the key's row")
        },
        {intervals: [2_000], timeout: 60_000}
      )
      await step('The profile shows the key', {card: true})
      await openRevoke(row, 'Drop', "the key's row")
      await step('The drop confirm')
      await confirmRevoke('Yes, drop it', REVOKE_KEY)
      // the key list holds a live device key of the second account, else it throws
      await expectPeer('the key dropped', pgpList, keys => !live(keys))
      await rowGone(row, "the key's row gone from the profile")
      await step('The key dropped')
    })
    await masked(async () => purgePeerPgp([fp]))
  })
})
