// Settings > Account on the phone, as the smoke account, one owned address per test: an address for
// this run (e2e-<runid>-<label>@example.com: example.com is reserved, so no mail reaches anyone) is
// added from the phone, then gets its verification mail sent again, or is made the primary address
// and the original made primary again, or is deleted from its row; each change is read back on the
// host (the address list is parse-anchored by its primary address). The add-phone screen is opened
// and cancelled (its Continue would send a real SMS: manual-only), and the delete-account confirm is
// opened with nothing ticked and cancelled (manual-only).
//
// The original primary address is read before the file runs and is compared in memory only: it is a
// real address, so it goes into no selector, step, check or error (`hidden` takes it out of a host
// error). The flow's afterEach makes it the primary address again when a test moved it, then deletes
// the test's own address if the account still lists it (a primary address cannot be deleted).
//
// Never pressed: the add-phone Continue, the delete-account confirm, "Open keybase.io in web
// browser", the original address's Verify, "Make searchable" / "Make unsearchable".
import {withCleanup} from '../../shared/cleanup.ts'
import {deleteEmailIfPresent, emails, primaryEmail, requireStampedEmail, setPrimaryEmail, stampedEmail} from '../../shared/settings'
import * as T from '../../shared/test-ids'
import {requireAppIsSmoke} from '../gate/accounts'
import {randomPW} from '../gate/app-ask'
import {elementInRow, innermost, type Rect} from '../gate/chat-lib.ts'
import {labelParts, sourceElements, sourceRect} from '../gate/page-source-lib.ts'
import {callsSince, currentCallSeq, uiCallCount, waitForUiCall} from '../gate/recorder'
import {manualEdge, step} from '../gate/step'
import {closeMessageMenu, dragUntilOnScreen} from '../helpers/chat'
import {el} from '../helpers/elements'
import {fillField, tapButton} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, elementWithLabelPartIn, NAMED_ELEMENT_TYPES, openMenuFrom, press, waitForSheetGone} from '../helpers/menus'
import {dismissKeyboard, escapeToTabs, HEADER_CANCEL} from '../helpers/navigate'
import {ACCOUNT_TAB, openAccountPage} from '../helpers/settings'
import {masked, textShown} from '../helpers/teams'

const ADD_EMAIL = 'keybase.1.emails.addEmail'
const SEND_VERIFICATION = 'keybase.1.emails.sendVerificationEmail'
const SET_PRIMARY = 'keybase.1.emails.setPrimaryEmail'
const DELETE_EMAIL = 'keybase.1.emails.deleteEmail'

const DELETE_ACCOUNT_BUTTON = '-ios predicate string:type == "XCUIElementTypeButton" AND label == "Delete account" AND visible == 1'
// what an address row draws its address as (selectable text can draw as a text view), and the row's
// line under it
const ROW_TYPES = ['XCUIElementTypeStaticText', 'XCUIElementTypeTextView', 'XCUIElementTypeOther']

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const plain = (s: string | undefined) => (s ?? '').replace(/\u00a0/g, ' ')

// The visible elements of `types`, read off one page source (an attribute call per element took most
// of a row's wait). Bound: one read 1.
const drawnOf = async (types: ReadonlyArray<string>) =>
  sourceElements(await browser.getPageSource()).filter(e => types.includes(e.type) && e.attrs['visible'] === 'true')

const middleIn = (r: Rect, band: Rect) => {
  const y = r.y + r.height / 2
  return y >= band.y && y <= band.y + band.height
}

describe('settings account', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   host      a host read 150 (whoami 15, four reads of 30, 5s apart);  polled  20s of reads, overrun
  //             by one 170
  //   page      openAddresses 142 (openAccountPage 126: openMore 50, the row scrolled to 54 and tapped
  //             1, screen 11, the page 10; the original's row 16)
  //   add       addFromPhone 569 (a host read 150, page 142, seq 2, button 7, screen 11, fill 26,
  //             step 2, keyboard 1, button 7, the call 12, its count 2, screen 21, polled 170, the
  //             row 16)
  //   row       a row waited for 16 (15, one read 1);  reads  a row's line waited for 16;  gone  32
  //             (the anchor row 16, then 15s of reads, overrun by one 1)
  //   menu      openRowMenu 37 (the row 16, in row 2, openMenuFrom 19);  item  chooseMenuItem 22,
  //             chooseSubtitled 22 (10s of reads, overrun by one 5, the tap 1, the sheet gone 5)
  //   button    tapButton 7 (6, its read 1);  screen  a screen waited for 11 (10, read 1), 21 with a
  //             20s wait;  text  textShown 6, 11 with a 10s wait
  //   header    the header's Cancel 6 (5, its tap 1)
  //   calls     one read 2;  waited for  12 (10, one read 2)
  //   step      2 (its 1s settle and the attach);  manual  2

  // the smoke account's primary address before the file; undefined until read
  let original: string | undefined
  // the address the running test added, once it is about to add it
  let owned: string | undefined

  // Runs a host read or write `f`; an error it throws names no account and not the original address.
  const hidden = async <R,>(f: () => Promise<R>): Promise<R> => {
    try {
      return await masked(f)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // no cause: the original message may hold the address
      // eslint-disable-next-line preserve-caught-error
      throw new Error(original ? msg.split(original).join('<the original primary address>') : msg)
    }
  }

  before(async function () {
    // a host read 150
    this.timeout(170_000)
    original = await hidden(async () => primaryEmail())
    check(!!original, 'the smoke account has no primary address')
  })

  // -- what the afterEach puts back ---------------------------------------------------------------

  // The original made primary again when a test moved it, then the test's address deleted if the
  // account still lists it (a primary address cannot be deleted, so this order). Bound:
  // setPrimaryEmail 380 (a read 150, the write 60, 20s of reads overrun by one 170),
  // deleteEmailIfPresent 380 (the same).
  const restoreEmails = async () => {
    if (original === undefined) return
    const want = original
    await hidden(async () => setPrimaryEmail(want))
    if (owned === undefined) return
    const addr = owned
    await hidden(async () => deleteEmailIfPresent(addr))
    owned = undefined
  }

  // Worst case (s): close 19, restoreEmails 760, escapeToTabs 30 = 809.
  afterEach(async function () {
    this.timeout(850_000)
    await withCleanup(closeMessageMenu, [restoreEmails, escapeToTabs])
  })

  // -- reads --------------------------------------------------------------------------------------

  // The account's entry for `addr` on the host, or undefined. Bound: a host read 150.
  const hostEmail = async (addr: string) => (await hidden(async () => emails())).find(e => e.email === addr)

  // Polls the host until `ok` takes the account's addresses. Bound: 170.
  const expectHost = async (what: string, ok: (list: Awaited<ReturnType<typeof emails>>) => boolean) =>
    waitFor(what, async () => (ok(await hidden(async () => emails())) ? true : undefined), {interval: 2_000, timeout: 20_000})

  // The rects of the texts on screen that read `addr`, innermost of nested ones. Bound: one read 1.
  const addressRects = async (addr: string) => {
    const rects = (await drawnOf(ROW_TYPES))
      .filter(e => plain(e.attrs['label']) === addr || plain(e.attrs['value']) === addr)
      .map(e => sourceRect(e.attrs))
    return innermost(rects).map(i => rects[i]!)
  }

  // The row of `addr`, once the account page draws it: the band across the screen its address sits
  // in, where its gear and the line under it are drawn too. Bound: `timeout`, plus one read 1.
  const addressRow = async (addr: string, what: string, timeout = 15_000): Promise<Rect> =>
    waitFor(
      what,
      async () => {
        const found = await addressRects(addr)
        if (found.length > 1) throw new Error(`${found.length} of ${what} drawn, not one`)
        const [text] = found
        if (!text) return undefined
        const {width} = await browser.getWindowRect()
        return {height: text.height + 32, width, x: 0, y: text.y - 16}
      },
      {interval: 500, timeout}
    )

  // Whether the row in `band` draws `word` as its line (or a part of it: "Primary • Not
  // searchable"). Bound: one read 1.
  const rowSays = async (band: Rect, word: string) =>
    (await drawnOf(NAMED_ELEMENT_TYPES)).some(
      e =>
        labelParts(e.attrs['label'] ?? '')
          .flatMap(p => p.split(' • '))
          .map(p => p.trim())
          .includes(word) && middleIn(sourceRect(e.attrs), band)
    )

  // Waits for the row of `addr` to draw `word` in its line (`want`) or not. Bound: the row 16, then
  // 15s of reads, overrun by one 1 = 32.
  const rowReads = async (addr: string, word: string, want: boolean, what: string) => {
    const row = await addressRow(addr, `${what}: its row`)
    await waitFor(what, async () => ((await rowSays(row, word)) === want ? true : undefined), {interval: 500, timeout: 15_000})
  }

  // Whether a text reading exactly `label` is drawn now. Bound: one read 1.
  const textShownNow = async (label: string) => (await drawnOf(NAMED_ELEMENT_TYPES)).some(e => plain(e.attrs['label']) === label)

  // Settings > Account with the account's addresses loaded (the original's row is always drawn).
  // Bound: openAccountPage 126, the row 16 = 142.
  const openAddresses = async () => {
    await openAccountPage()
    await addressRow(original!, "the original primary address's row")
  }

  // Opens the menu of `addr`'s row from its gear. Bound: 37.
  const openRowMenu = async (addr: string, what: string) => {
    const gear = await elementInRow(await addressRow(addr, `${what}'s row`), T.SETTINGS_EMAIL_ROW_MENU)
    await openMenuFrom(what, async () => gear.click())
  }

  // Picks the open menu's item `title` that draws a subtitle under it (its label "<icon>, <title>,
  // <subtitle>"), by that label part, compared in memory. Bound: 22.
  const chooseSubtitled = async (title: string) => {
    const item = await waitFor(
      `"${title}" in the menu`,
      async () => elementWithLabelPartIn(['XCUIElementTypeOther'], title, `"${title}" in the menu`, {forTap: true}),
      {interval: 300, timeout: 10_000}
    )
    await press(item, `the menu's "${title}"`)
    await waitForSheetGone(5_000)
  }

  // Taps the modal's header Cancel. Bound: 6.
  const tapHeaderCancel = async () => {
    await browser.$(HEADER_CANCEL).waitForExist({timeout: 5_000})
    await browser.$(HEADER_CANCEL).click()
  }

  // Adds `addr` from the phone (Add email, the address, Continue; "searchable" left as it defaults)
  // and reads it on the host, unverified, and on the account page. Bound: 569.
  const addFromPhone = async (addr: string) => {
    requireStampedEmail(addr)
    check((await hostEmail(addr)) === undefined, "the test's address is on the account before the test")
    owned = addr
    await openAddresses()
    const seq = await currentCallSeq()
    await tapButton('Add email', "the account page's Add email")
    await expectScreen('the add email screen', 'settingsAddEmail')
    await fillField(() => el(T.SETTINGS_EMAIL_INPUT), addr, 'the email field')
    await step('The run address typed')
    await dismissKeyboard()
    await tapButton('Continue', "the add email screen's Continue")
    await waitForUiCall('the add email call to go out', seq, ADD_EMAIL)
    check((await uiCallCount(seq, ADD_EMAIL)) === 1, 'Continue sent the add email call more than once')
    await expectScreen('the account page after the add', ACCOUNT_TAB, () => true, 20_000)
    await expectHost('the new address on the account, unverified', list => list.some(e => e.email === addr && !e.isVerified))
    await addressRow(addr, 'the new address row')
  }

  // -- the tests ----------------------------------------------------------------------------------

  it('an added address gets its verification mail sent again', async function () {
    // worst case (s): add 569, host 150, the pause 2, step 2, seq 2, menu 37, item 22, the call 12,
    // its count 2, polled 170, reads 32, step 2 = 1002
    this.timeout(1_050_000)
    const addr = stampedEmail('verify')
    await addFromPhone(addr)
    const before = (await hostEmail(addr))?.lastVerifyEmailDate ?? 0
    await step('The run address added', {card: true})
    // the server keeps the date in whole seconds: a resend in the add's own second would not move it
    await sleep(1_100)

    const seq = await currentCallSeq()
    await openRowMenu(addr, "the run address's menu")
    await chooseMenuItem('Verify')
    await waitForUiCall('the verification mail call to go out', seq, SEND_VERIFICATION)
    check((await uiCallCount(seq, SEND_VERIFICATION)) === 1, 'Verify sent the verification mail call more than once')
    await expectHost('the server to record the new verification mail', list =>
      list.some(e => e.email === addr && e.lastVerifyEmailDate > before)
    )
    await rowReads(addr, 'Check your inbox', true, "the run address's row to say the mail was sent")
    await step('The verification mail sent again')
  })

  it('an added address made primary, then the original made primary again', async function () {
    // worst case (s): add 569, step 2, then twice: seq 2, menu 37, item 22, the call 12, its count 2,
    // polled 170, reads 32, step 2 (279) = 1129
    this.timeout(1_150_000)
    const addr = stampedEmail('primary')
    const was = original!
    await addFromPhone(addr)
    await step('The run address added')

    const seq = await currentCallSeq()
    await openRowMenu(addr, "the run address's menu")
    await chooseSubtitled('Make primary')
    await waitForUiCall('the make primary call to go out', seq, SET_PRIMARY)
    check((await uiCallCount(seq, SET_PRIMARY)) === 1, 'Make primary sent its call more than once')
    // pinned: the server takes an unverified address as the primary one
    await expectHost('the run address primary on the server', list => list.some(e => e.email === addr && e.isPrimary))
    await rowReads(was, 'Primary', false, "the original address's row to stop saying Primary")
    await step('The run address made primary', {card: true})

    const back = await currentCallSeq()
    await openRowMenu(was, "the original address's menu")
    await chooseSubtitled('Make primary')
    await waitForUiCall('the make primary call to go out', back, SET_PRIMARY)
    check((await uiCallCount(back, SET_PRIMARY)) === 1, 'Make primary sent its call more than once')
    await expectHost('the original address primary again on the server', list => list.some(e => e.email === was && e.isPrimary))
    await rowReads(was, 'Primary', true, "the original address's row to say Primary")
    await step('The original address primary again')
  })

  it('an added address deleted from its row', async function () {
    // worst case (s): add 569, step 2, menu 37, item 22, screen 11, the prompt 6, step 2, seq 2,
    // button 7, the call 12, its count 2, screen 21, polled 170, gone 32, step 2 = 897
    this.timeout(900_000)
    const addr = stampedEmail('delete')
    const was = original!
    await addFromPhone(addr)
    await step('The run address added')

    await openRowMenu(addr, "the run address's menu")
    await chooseMenuItem('Delete')
    await expectScreen('the delete address confirm', 'settingsDeleteAddress', p => p['address'] === addr && p['type'] === 'email')
    await textShown(`Delete ${addr}?`, "the delete address confirm's prompt")
    await step('The delete confirm')

    const seq = await currentCallSeq()
    await tapButton('Yes, delete', "the delete confirm's Yes, delete")
    await waitForUiCall('the delete email call to go out', seq, DELETE_EMAIL)
    check((await uiCallCount(seq, DELETE_EMAIL)) === 1, 'Yes, delete sent the delete email call more than once')
    await expectScreen('the account page after the delete', ACCOUNT_TAB, () => true, 20_000)
    // the list read is anchored by its primary address, and the original is the primary one
    await expectHost('the run address gone from the account', list => !list.some(e => e.email === addr) && list.some(e => e.email === was && e.isPrimary))
    await addressRow(was, "the original primary address's row")
    await waitFor('the run address row gone', async () => ((await addressRects(addr)).length === 0 ? true : undefined), {
      interval: 500,
      timeout: 15_000,
    })
    owned = undefined
    await step('The run address deleted', {card: true})
  })

  it('the add phone number screen opens and is cancelled, nothing sent', async function () {
    // worst case (s): page 142, seq 2, button 7, screen 11, text 11, manual 2, header 6, screen 11,
    // calls 2, step 2 = 196
    this.timeout(210_000)
    await openAddresses()
    const seq = await currentCallSeq()
    await tapButton('Add phone number', "the account page's Add phone number")
    await expectScreen('the add phone number screen', 'settingsAddPhone')
    await textShown('Allow friends to find you by this phone number', "the add phone number screen's searchable switch", 10_000)
    // its Continue sends a real SMS: a person takes over from here
    await manualEdge('sms-code')

    await tapHeaderCancel()
    await expectScreen('the account page after the cancel', ACCOUNT_TAB)
    check(!(await callsSince(seq)).some(c => c.method.startsWith('keybase.1.phoneNumbers.')), 'the add phone number screen sent a phone number call')
    await step('Back on the account page, nothing sent')
  })

  it('the delete account confirm opens with nothing ticked and is cancelled', async function () {
    // worst case (s): smoke 1, the passphrase state 22, page 142, drag 20, seq 2, its tap 1, screen
    // 11, the prompt 11, the confirm button 11 and its state 1, manual 2, header 6, screen 11, the
    // prompt gone 1, calls 2, step 2 = 246
    this.timeout(260_000)
    // the passphrase state is the signed-in account's
    await requireAppIsSmoke()
    // an account with no password of its own deletes from this confirm at once
    check(!(await randomPW()), 'the smoke account has no password of its own, so its delete account confirm deletes at once; refusing')
    await openAddresses()
    await dragUntilOnScreen('the Delete account button', () => browser.$(DELETE_ACCOUNT_BUTTON))
    const seq = await currentCallSeq()
    await browser.$(DELETE_ACCOUNT_BUTTON).click()
    await expectScreen('the delete account confirm', 'deleteConfirm')
    await textShown('Permanently delete your account?', "the delete account confirm's prompt", 10_000)
    // nothing is ticked, so its confirm cannot be pressed: a disabled button draws as its text alone
    // (no button element), and no enabled button reads its label
    await textShown('Yes, permanently delete it', "the delete account confirm's button")
    const pressable = await browser.$$(`-ios predicate string:type == "XCUIElementTypeButton" AND label == "Yes, permanently delete it" AND enabled == 1`).getElements()
    check(pressable.length === 0, "the delete account confirm's button can be pressed with nothing ticked")
    await manualEdge('delete-account-confirm')

    await tapHeaderCancel()
    await expectScreen('the account page after the cancel', ACCOUNT_TAB)
    check(!(await textShownNow('Permanently delete your account?')), 'the delete account confirm is still drawn after its Cancel')
    const calls = (await callsSince(seq)).map(c => c.method)
    check(!calls.includes('keybase.1.login.accountDelete'), 'the delete account confirm sent an account delete')
    await step('Back on the account page')
  })
})
