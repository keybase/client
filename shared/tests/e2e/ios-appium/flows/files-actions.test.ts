// What the phone sends to change files and folders: a folder made from a folder's More sheet, and a
// file renamed, moved, copied, deleted and shared to chat from its row's menu, each in a work folder
// of the smoke account's private folder that the host makes for the one test
// (e2e-<runid>-files-<hex>, with the corpus text file in it under stamped names); the smoke+second
// folder ignored from its row's menu; and "Sync on this device" turned on for that folder, kept
// through a relaunch, and off again.
//
// The host stays on the smoke account: it makes the work folders and their entries, reads back what
// the phone wrote (the phone's writes reach the host once its journal flushes), and reads the
// favorites and the self conversation. The sync config lives on the phone, so it is read and put back
// through the phone's own service. Before a tap that writes, the screen up is checked to be aimed
// inside the test's work folder. What a test changes is put back by the flow's afterEach, after a
// timeout too: the work folders and the smoke+second folder's entry deleted, the folder a favorite
// again, its sync config as it was.
//
// Entries a flow finds by their row have no extension: the app draws a name's extension as a text of
// its own, so the row's label would not hold the name whole.
import {loadE2EAccounts} from '../../accounts/env'
import {maskE2E} from '../../accounts/sweep-lib.ts'
import {corpusEntry} from '../../fixtures/corpus/corpus'
import {directConvIDFromCli, readFromCli} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {pairFavoriteState, pairFolder, refavoritePair} from '../../shared/favorites.ts'
import {kbfsCopyIn, kbfsList, kbfsMkdir, leaf, newWorkFolder, removeOwnKbfs, requireOwnPath, stampedEntry, waitForKbfs} from '../../shared/files.ts'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {requireAppIsSmoke} from '../gate/accounts'
import {folderSyncConfig, setFolderSyncConfig, type FolderSyncConfig} from '../gate/app-ask'
import {creditSurface} from '../gate/attempt'
import {requireSecondNotBlocked} from '../gate/blocks'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {focusedFieldText, focusSecretField} from '../gate/secret-input'
import {step} from '../gate/step'
import {closeMessageMenu, expectPersists, hideKeyboard, isKeyboardUp, typeIntoFocused} from '../helpers/chat'
import {el} from '../helpers/elements'
import {filesRowNamed, fillHiddenField, openFolder, openFolderMoreSheet, openRowMenu, tapButton} from '../helpers/files'
import {expectScreen, visibleScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, elementWithLabelPart, openMenuFrom, tapElement, tapFrame, tapMenuItemOnce, waitForSheetGone} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'

const txt = corpusEntry('e2e-c.txt').file

describe('files actions', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   work      the host's mkdir of the work folder 60, and 60 for each entry it puts in it
  //   open      openFolder of a work folder 365 (the root 56, the type row 31, its tap 1 and screen
  //             11, then two levels of the row 121, its tap 1 and screen 11);  of the smoke+second
  //             folder 142 (one level of 31, 1, 11);  of /keybase/private 99
  //   entry     an entry's row, which may arrive late, 121 (120, one drag 1);  row  one drawn 31
  //   menu      openRowMenu 52 (the row 31, its button 2, openMenuFrom 19);  item  chooseMenuItem 22
  //             (15, overrun by one drag 1, the tap 1 and the sheet gone 5);  more  openFolderMoreSheet 28
  //   field     fillHiddenField 30;  button  tapButton 6;  screen  a screen waited for 11, read 1
  //   picker    the picker 10;  gone  10
  //   calls     the recorder's call log, one read 2;  waited for  10
  //   kbfs      waitForKbfs 180 (120, overrun by one listing 60);  listing  one host listing 60
  //   favorite  the host's favorites read 75 (whoami 15, the call 60), polled 95
  //   app       one ask of the phone's own service 25 (20, the pause and resume);  polled 45
  //   relaunch  relaunchApp 200;  signed in  90;  smoke  the app's account read 10
  //   self      the self conversation's id from the host CLI 60;  cli  a host read polled 120 (60,
  //             overrun by one read's 60)
  //   step      2 (its 1s settle and the attach)

  before(async function () {
    // the smoke+second folder is ignored while the second account is blocked: a failed chat-blocks
    // restore refuses here. The host read 75s.
    this.timeout(90_000)
    await requireSecondNotBlocked()
  })

  // -- reads --------------------------------------------------------------------------------------

  // The names the host lists in `dir` (a work folder or a folder in one). Bound: one listing 60.
  const hostNames = async (dir: string) => {
    try {
      return new Set((await kbfsList(dir)).map(e => e.name))
    } catch (e) {
      // the CLI's error holds the path, and with it the account names
      const msg = (e instanceof Error ? e.message : String(e)).split(dir).join('<folder>')
      // eslint-disable-next-line preserve-caught-error
      throw new Error(`the host's listing of a work folder failed: ${maskE2E(msg)}`)
    }
  }

  // Refuses, before a tap that writes, unless the screen up is `name` and `ok` takes its params.
  // Bound: one read 1.
  const requireScreen = async (what: string, name: string, ok: (params: Record<string, unknown>) => boolean) => {
    const s = await visibleScreen()
    check(s?.name === name && ok(s.params ?? {}), `${what} is not aimed where the test means: not tapping`)
  }

  // `p` is an entry of the work folder `folder` (or one inside it) this run made.
  const inWorkFolder = (folder: string, p: unknown) => typeof p === 'string' && p.startsWith(`${folder}/`) && requireOwnPath(p) === p

  // -- what the afterEach puts back ---------------------------------------------------------------
  // Each is set before the change it undoes and cleared once its restore reads back, so the restore
  // runs only when needed and a second run of it does nothing.

  // work folders the host made for a test, and entries it put in the smoke+second folder
  const madePaths = new Set<string>()
  // the smoke+second folder's row menu was told to ignore it
  let pairIgnored = false
  // the smoke+second folder's sync config on the phone before a test changed it
  let syncBefore: FolderSyncConfig | undefined

  // A work folder for one test, made by the host, with the corpus text file under each of `files` and
  // a folder under each of `dirs` in it. Bound: work 60, and 60 for each entry.
  const workFolder = async ({dirs = [], files = []}: {dirs?: Array<string>; files?: Array<string>}) => {
    const folder = newWorkFolder()
    madePaths.add(folder)
    await kbfsMkdir(folder)
    for (const d of dirs) await kbfsMkdir(`${folder}/${d}`)
    for (const f of files) await kbfsCopyIn(txt, `${folder}/${f}`)
    return folder
  }

  // The work folder open on the phone with each of `names` drawn in it. Bound: open 365, then entry
  // 121 for each name.
  const openWorkFolder = async (folder: string, names: ReadonlyArray<string>) => {
    await openFolder(folder, 120_000)
    for (const n of names) await filesRowNamed(n, 'an entry the host put in the work folder', {timeout: 120_000})
  }

  // Bound: favorite 75 and the favoriteAdd's read back 170 (the call 75, 20s of reads overrun by one).
  const restorePairFavorite = async () => {
    if (!pairIgnored) return
    const now = await pairFavoriteState()
    if (!now.favorite || now.ignored) await refavoritePair()
    pairIgnored = false
  }

  // Bound: 195 a path (its listing 60, whoami 15, the delete 60, the listing 60).
  const removeMadePaths = async () => {
    for (const p of [...madePaths]) {
      await removeOwnKbfs(p)
      madePaths.delete(p)
    }
  }

  // The phone's restores are the signed-in account's: they run only on the smoke account, and a state
  // left set waits for the next afterEach. Bound: smoke 10, then three asks 75.
  const restoreSync = async () => {
    if (syncBefore === undefined) return
    await requireAppIsSmoke()
    const want = syncBefore
    const same = (c: FolderSyncConfig) => c.mode === want.mode && JSON.stringify(c.paths) === JSON.stringify(want.paths)
    if (!same(await folderSyncConfig(pairFolder()))) await setFolderSyncConfig(pairFolder(), want)
    check(same(await folderSyncConfig(pairFolder())), "the smoke+second folder's sync config did not go back")
    syncBefore = undefined
  }

  // A destination picker left up (one per try of a test that failed in it), closed from its header's
  // Cancel: its header reports visible=false, so escapeToTabs does not see it. Bound: three tries of
  // the read 1, the tap 1 and the picker gone 5 = 21.
  const closeDestinationPickers = async () => {
    for (let i = 0; i < 3 && (await el(T.FILES_DESTINATION_PICKER).isExisting()); i++) {
      const cancels = await browser
        .$$('-ios class chain:**/XCUIElementTypeNavigationBar/XCUIElementTypeButton[`label == "Cancel"`]')
        .getElements()
      if (!cancels.length) break
      const before = await browser.$$(`~${T.FILES_DESTINATION_PICKER}`).length
      await cancels[cancels.length - 1]!.click()
      await waitFor('a destination picker to close', async () => ((await browser.$$(`~${T.FILES_DESTINATION_PICKER}`).length) < before ? true : undefined), {
        interval: 250,
        timeout: 5_000,
      }).catch(() => undefined)
    }
  }

  // Nothing a test changed left behind, after a timeout too. The host's restores go first, then the
  // phone's. Worst case (s): close 19, keyboard 5, pickers 21, the favorite 245, a work folder and the
  // smoke+second folder's entry 390, the sync config 85, escape 30 = 795.
  afterEach(async function () {
    this.timeout(800_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, closeDestinationPickers, restorePairFavorite, removeMadePaths, restoreSync, escapeToTabs])
  })

  // -- the work folder ----------------------------------------------------------------------------

  it("a folder made from the folder's More sheet", async function () {
    // worst case (s): work 60, open 365, screen 1, more 28, item 22, field 30, screen 1, button 1,
    // kbfs 180, row 31, step 2 = 721
    this.timeout(760_000)
    const folder = await workFolder({})
    const made = stampedEntry('made')
    await openWorkFolder(folder, [])
    await requireScreen("the folder's More sheet", 'fsBrowse', p => p['path'] === folder)
    await openFolderMoreSheet()
    await chooseMenuItem('New folder')
    await el(T.FILES_EDITING_ROW).waitForExist({timeout: 10_000})
    await fillHiddenField(T.FILES_EDITING_INPUT, made, "the new folder's name field")
    await requireScreen('the new folder', 'fsBrowse', p => p['path'] === folder)
    await tapElement(await el(T.FILES_EDITING_SAVE).getElement(), "the name's Save")
    await waitForKbfs(`${folder}/${made}`, 'dir')
    await filesRowNamed(made, 'the new folder row')
    await step('A new folder made in the work folder', {card: true})
  })

  it("a file renamed from its row's menu", async function () {
    // worst case (s): work 120, open 365, entry 121, step 2, menu 52, item 22, the editing row 10,
    // its field focused 10 and read 1, field 30, screen 1, calls 2, button 1, calls 10, kbfs 180,
    // listing 60, row 31, step 2 = 1020
    this.timeout(1_040_000)
    const from = stampedEntry('from')
    const to = stampedEntry('to')
    const folder = await workFolder({files: [from]})
    await openWorkFolder(folder, [from])
    await step('The file in the work folder')

    await openRowMenu(from, 'the file row')
    await chooseMenuItem('Rename')
    // the editing row starts on the name it renames: the row being edited is the file's
    await el(T.FILES_EDITING_ROW).waitForExist({timeout: 10_000})
    await focusSecretField(T.FILES_EDITING_INPUT)
    check((await focusedFieldText(T.FILES_EDITING_INPUT)) === from, 'the row being renamed is not the file')
    await fillHiddenField(T.FILES_EDITING_INPUT, to, "the file's name field")
    await requireScreen('the rename', 'fsBrowse', p => p['path'] === folder)
    const seq = await currentCallSeq()
    await tapElement(await el(T.FILES_EDITING_SAVE).getElement(), "the name's Save")
    await waitForUiCall('the rename to go out', seq, 'keybase.1.SimpleFS.simpleFSMove')
    await waitForKbfs(`${folder}/${to}`, 'file')
    // the new name listed shows the listing has the rename: the old name is gone in the same read
    const names = await hostNames(folder)
    check(names.has(to) && !names.has(from), 'the host does not list the file under its new name alone')
    await filesRowNamed(to, 'the renamed file row')
    await step('Renamed', {card: true})
  })

  // Moves or copies a file into a folder beside it with the destination picker, which opens on the
  // work folder: the folder beside the file is opened in it, and `action` tapped there. Bound: work
  // 180, open 365, entry 242, step 2, menu 52, item 22, picker 10, screen 11, the picker's row 31, the
  // tap 1, screen 11, its read 1, calls 2, the action 7 (5s of reads, its press 2), gone 10 = 947.
  const moveOrCopy = async (action: 'Copy here' | 'Move here') => {
    const file = stampedEntry('mc')
    const dest = stampedEntry('dest')
    const folder = await workFolder({dirs: [dest], files: [file]})
    const source = `${folder}/${file}`
    const target = `${folder}/${dest}`
    await openWorkFolder(folder, [file, dest])
    await step('The file and a folder beside it')

    await openRowMenu(file, 'the file row')
    await chooseMenuItem('Move or Copy')
    await el(T.FILES_DESTINATION_PICKER).waitForExist({timeout: 10_000})
    await expectScreen('the destination picker on the work folder', 'destinationPicker', p => p['parentPath'] === folder)
    // the picker's rows are not under its testID's element in XCUITest's tree, but under the modal
    // screen holding it (the folder screen behind the modal draws the same rows)
    const picker = await browser.$(`//*[@name="${T.MODAL_SCREEN}"][.//*[@name="${T.FILES_DESTINATION_PICKER}"]]`).getElement()
    const row = await filesRowNamed(dest, "the picker's row of the folder beside the file", {within: picker})
    await tapFrame(row.rect, "the picker's folder row")
    const aimed = (p: Record<string, unknown>) => {
      const src = (p['source'] as {path?: unknown} | undefined)?.path
      return p['parentPath'] === target && inWorkFolder(folder, target) && src === source && inWorkFolder(folder, src)
    }
    await expectScreen('the destination picker on the folder beside the file', 'destinationPicker', aimed)
    await requireScreen(`the picker's ${action}`, 'destinationPicker', aimed)
    const seq = await currentCallSeq()
    // the action is a row of the picker (one accessible box, its label ", Move here"), reported
    // visible=false as on a folder screen, so it is tapped at its frame
    const button = await waitFor(
      `the picker's ${action}`,
      async () =>
        elementWithLabelPart(
          `-ios predicate string:type == "XCUIElementTypeOther" AND label CONTAINS ${JSON.stringify(action)}`,
          action,
          `the picker's ${action}`
        ),
      {interval: 250, timeout: 5_000}
    )
    await tapElement(button, `the picker's ${action}`)
    await el(T.FILES_DESTINATION_PICKER).waitForExist({reverse: true, timeout: 10_000})
    return {dest, file, folder, seq, target}
  }

  it('a file moved into a folder beside it with the destination picker', async function () {
    // worst case (s): moveOrCopy 947, calls 10, kbfs 180, listing 60, step 2 = 1199
    this.timeout(1_250_000)
    const {dest, file, folder, seq, target} = await moveOrCopy('Move here')
    await waitForUiCall('the move to go out', seq, 'keybase.1.SimpleFS.simpleFSMove')
    await waitForKbfs(`${target}/${file}`, 'file')
    const names = await hostNames(folder)
    check(names.has(dest) && !names.has(file), 'the host still lists the moved file beside its folder')
    await step('Moved', {card: true})
  })

  it('a file copied into a folder beside it with the destination picker', async function () {
    // worst case (s): moveOrCopy 947, calls 10, kbfs 180, listing 60, step 2 = 1199
    this.timeout(1_250_000)
    const {dest, file, folder, seq, target} = await moveOrCopy('Copy here')
    await waitForUiCall('the copy to go out', seq, 'keybase.1.SimpleFS.simpleFSCopyRecursive')
    await waitForKbfs(`${target}/${file}`, 'file')
    const names = await hostNames(folder)
    check(names.has(dest) && names.has(file), 'the host does not list the copied file beside its folder')
    await step('Copied', {card: true})
  })

  it("a file deleted from its row's menu, the file beside it kept", async function () {
    // worst case (s): work 180, open 365, entry 242, step 2, menu 52, item 22, screen 11, its read 1,
    // calls 2, button 6, calls 10, kbfs 180, listing 60, step 2 = 1135
    this.timeout(1_180_000)
    const gone = stampedEntry('gone')
    const kept = stampedEntry('kept')
    const folder = await workFolder({files: [gone, kept]})
    await openWorkFolder(folder, [gone, kept])
    await step('Two files in the work folder')

    await openRowMenu(gone, 'the file row')
    await chooseMenuItem('Delete')
    const aimed = (p: Record<string, unknown>) => p['path'] === `${folder}/${gone}` && inWorkFolder(folder, p['path'])
    await expectScreen('the delete confirmation for the file', 'confirmDelete', aimed)
    await requireScreen('the delete confirmation', 'confirmDelete', aimed)
    const seq = await currentCallSeq()
    await tapButton('Yes, delete', "the confirmation's Yes, delete")
    await waitForUiCall('the delete to go out', seq, 'keybase.1.SimpleFS.simpleFSRemove')
    await waitForKbfs(`${folder}/${gone}`, 'absent')
    // the file kept, in the same listing, shows it is current
    const names = await hostNames(folder)
    check(names.has(kept) && !names.has(gone), 'the host does not list the kept file alone')
    await step('Deleted, the other file kept', {card: true})
  })

  it("a file shared to the self conversation from its row's menu, with a caption", async function () {
    // worst case (s): self 60, work 120, open 365, entry 121, step 2, menu 52, item 22, screen 11, the
    // search 10, its tap 1, the keyboard 5, the typing 15, the result polled 20, its tap 1, screen 21
    // (20, its read), field 30, calls 2, button 6, calls 10, cli 120, step 2 = 996
    this.timeout(1_040_000)
    const {smokeUser} = loadE2EAccounts()
    const selfConvID = await directConvIDFromCli(smokeUser)
    const file = stampedEntry('share')
    const title = e2eMarker('fshare')
    const folder = await workFolder({files: [file]})
    const path = `${folder}/${file}`
    await openWorkFolder(folder, [file])
    await step('The file in the work folder')

    await openRowMenu(file, 'the file row')
    // the item reads its subtitle after its title
    await chooseMenuItem('Share to Chat, The file will be sent as an attachment.')
    await expectScreen('the conversation picker for the file', 'chatSendToChat', p => JSON.stringify(p['sendPaths']) === JSON.stringify([path]))
    // the picker's search is a SearchFilter, one accessible box with its field not in the tree, and
    // this modal reports its elements visible=false: the box is tapped at its frame and the account
    // typed as key presses
    await el(T.SEARCH_FILTER).waitForExist({timeout: 10_000})
    await tapElement(await el(T.SEARCH_FILTER).getElement(), "the picker's search")
    await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout: 5_000})
    await typeIntoFocused("the picker's search", smokeUser)
    // the self conversation is the result named by the account alone
    const result = await waitFor(
      'the self conversation among the results',
      async () => elementWithLabelPart(`-ios predicate string:name == "${T.CHAT_SEND_TO_CHAT_ROW}"`, smokeUser, 'the self conversation result'),
      {interval: 500, timeout: 20_000}
    )
    await tapElement(result, 'the self conversation result')
    await expectScreen(
      'the titles screen for the self conversation',
      'chatAttachmentGetTitles',
      p => p['conversationIDKey'] === selfConvID && p['tlfName'] === smokeUser,
      20_000
    )
    // the caption field is inside the screen's one tappable box, so not in XCUITest's tree
    await fillHiddenField(T.CHAT_ATTACHMENT_CAPTION, title, 'the caption field')
    const seq = await currentCallSeq()
    await tapButton('Send', "the titles screen's Send")
    await waitForUiCall('the attachment to go out', seq, 'chat.1.local.postFileAttachmentLocalNonblock')
    const shared = await waitFor(
      'the host to read the captioned attachment in the self conversation',
      async () => {
        const found = (await readFromCli({tlfName: smokeUser}, 30)).filter(
          m => m.content.type === 'attachment' && m.content.attachment?.object?.title === title
        )
        if (found.length > 1) throw new Error(`${found.length} attachments carry the caption, not one`)
        return found[0]
      },
      {interval: 2_000, timeout: 60_000}
    )
    check(leaf(shared.content.attachment?.object?.filename ?? '') === file, 'the captioned attachment is not the shared file')
    await step('Shared to the self conversation', {card: true})
  })

  // -- the smoke+second folder --------------------------------------------------------------------

  it("the smoke+second folder ignored from its row's menu", async function () {
    // worst case (s): favorite 75, open 99, its read 1, menu 52, calls 2, item 22, calls 10, favorite
    // 95, step 2 = 358
    this.timeout(400_000)
    const before = await pairFavoriteState()
    check(before.favorite && !before.ignored, 'the smoke+second folder does not start a favorite (a failed restore left it ignored)')
    await openFolder('/keybase/private')
    await requireScreen('the folder list', 'fsBrowse', p => p['path'] === '/keybase/private')
    await openRowMenu(leaf(pairFolder()), 'the smoke+second folder row')
    const seq = await currentCallSeq()
    pairIgnored = true
    // the item reads its subtitle after its title
    await chooseMenuItem('Ignore this folder, Will hide the folder from your list.')
    await waitForUiCall('the ignore to go out', seq, 'keybase.1.favorite.favoriteIgnore')
    await waitFor(
      'the host to read the folder ignored',
      async () => {
        const now = await pairFavoriteState()
        return !now.favorite && now.ignored ? true : undefined
      },
      {interval: 1_000, timeout: 20_000}
    )
    // the private folder list holds the smoke account's folders shared with people who are not test
    // accounts
    await step('Ignored', {screenshot: false})
  })

  it('Sync on this device turned on for the smoke+second folder stays on through a relaunch, and turns off', async function () {
    // worst case (s): smoke 10, app 25, work 60 (the entry), open 142, the toggle 120, its read 1,
    // calls 2, the tap 1, calls 10, app 45, step 2 = 418; relaunch 200, signed in 90, open 142, the
    // toggle 30, app 25, step 2 = 489; smoke 10, its read 1, calls 2, the sheet 19, the tap 1, calls
    // 10, app 45, the sheet gone 21 (20, the bar read 1), step 2 = 111; = 1018
    this.timeout(1_058_000)
    const pair = pairFolder()
    await requireAppIsSmoke()
    const original = await folderSyncConfig(pair)
    check(original.mode === 'disabled', 'the smoke+second folder does not start unsynced on the phone (a failed restore left it synced)')
    syncBefore = original
    const expectSync = async (want: FolderSyncConfig['mode']) =>
      waitFor(`the phone to read the folder ${want}`, async () => ((await folderSyncConfig(pair)).mode === want ? true : undefined), {
        interval: 500,
        timeout: 20_000,
      })

    // the switch is hidden on an empty folder that is not synced
    const entry = `${pair}/${stampedEntry('sync')}`
    madePaths.add(entry)
    await kbfsMkdir(entry)
    await openFolder(pair)
    await el(T.FILES_SYNC_TOGGLE).waitForExist({timeout: 120_000})
    await requireScreen('the sync switch', 'fsBrowse', p => p['path'] === pair)
    let seq = await currentCallSeq()
    await tapElement(await el(T.FILES_SYNC_TOGGLE).getElement(), "the sync switch")
    await waitForUiCall('the sync to go out', seq, 'keybase.1.SimpleFS.simpleFSSetFolderSyncConfig')
    await expectSync('enabled')
    await step('Synced on this device')

    await expectPersists(
      "the folder's sync",
      async () => {
        await openFolder(pair)
        await el(T.FILES_SYNC_TOGGLE).waitForExist({timeout: 30_000})
        return (await folderSyncConfig(pair)).mode
      },
      'enabled'
    )
    creditSurface('relaunch')
    await step('After a relaunch the folder is still synced')

    // the relaunched app is the one whose sync config this test changed
    await requireAppIsSmoke()
    await requireScreen('the sync switch', 'fsBrowse', p => p['path'] === pair)
    seq = await currentCallSeq()
    await openMenuFrom('the unsync confirmation', async () => tapElement(await el(T.FILES_SYNC_TOGGLE).getElement(), "the sync switch"))
    // one tap: the sheet stays up until the unsync lands, so chooseMenuItem's second try would send it again
    await tapMenuItemOnce('Yes, unsync')
    await waitForUiCall('the unsync to go out', seq, 'keybase.1.SimpleFS.simpleFSSetFolderSyncConfig')
    await expectSync('disabled')
    await waitForSheetGone(20_000)
    await step('Unsynced', {card: true})
  })
})
