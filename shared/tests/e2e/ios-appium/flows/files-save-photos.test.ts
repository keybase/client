// Save to Photos from the phone: an image in Files saved from its row's menu, a large one whose save
// is cancelled from the menu's Close while it downloads, and an image the second account attaches in
// chat saved from its message menu. Each save is read back as the one asset id the photo library did
// not hold before the test (not the newest by date: a saved file keeps its own date, which can tie
// with the corpus's), an image of the corpus png's pixel size; that id is recorded then, and deleted
// again by it (iOS's own confirm tapped), read back gone. A cancelled save adds nothing.
//
// Saving to the library needs add access (granted already on the gate's phone) and the read-back and
// delete need full access, which a simctl grant does not give PhotoKit: the body takes both privacy
// tokens (grantPrivacy photos-add, then photos), then the app asks for full access and the system
// prompt's Allow Full Access is tapped. With full access the flow only reads the library's asset ids
// and deletes the ids it recorded as its proven saves, never another. The library's ids before a
// save are read twice and must agree and hold the corpus (a read while full access takes effect can
// come back short). The afterEach deletes a recorded photo a test left, and only reports (poisoning
// the gate, naming the ids) an asset new since the test began that was never recorded; then it puts
// both permissions back (photos reset, photos-add granted again: iOS keeps one of the two) and reads
// them back; any of it failing poisons the gate.
//
// The phone's Save is no regular download: no download card shows (the footer's cards are regular
// downloads only), so the save is read on the menu's own "In progress, Save" item and the calls it
// sends: simpleFSStartDownload, then simpleFSDismissDownload once the photo is saved, or once the
// sheet is closed (the user's cancel; the service cancels a download it dismisses). The Files images
// sit in a work folder of the smoke account's private folder that the host makes for each test
// (e2e-<runid>-files-<hex>), under stamped names that keep the extension (the photo library takes an
// image by it); the chat image in a throwaway channel of KB_E2E_TEAM made for the test. The
// afterEach deletes both.
import {randomBytes} from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import {loadE2EEnv} from '../../accounts/env'
import {CORPUS, corpusEntry} from '../../fixtures/corpus/corpus'
import {ensureChatData} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {kbfsCopyIn, kbfsMkdir, newWorkFolder, removeOwnKbfs, requireOwnPath, stampedEntry} from '../../shared/files.ts'
import {sendWithRetry} from '../../shared/peer-actors'
import {e2eMarker, e2eRunId} from '../../shared/run-marker'
import {assetInfo, libraryAssetIds, phoneDownloads} from '../gate/app-ask'
import {requireSecondNotBlocked} from '../gate/blocks'
import {grantPrivacy, imageProps, launchIfGone, restorePrivacy} from '../gate/device'
import type {PrivacyRestore} from '../gate/device-lib'
import {sourceElements} from '../gate/page-source-lib.ts'
import {guarded} from '../gate/poison-lib.ts'
import {currentCallSeq, uiCallCount, waitForUiCall} from '../gate/recorder'
import {cleanupPlan, newAssetIds, noisePng, requireSavedImage, requireWholeLibraryRead} from '../gate/save-photos-lib.ts'
import {step} from '../gate/step'
import {deleteSavedPhoto, grantFullPhotoAccess} from '../gate/system-ui'
import {closeMessageMenu, hideKeyboard, openConversation, openMessageMenu, scrollRowIntoView, storedAttachment, waitForRow} from '../helpers/chat'
import {filesRowNamed, openFolder, openRowMenu} from '../helpers/files'
import {visibleScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, menuSheet, tapMenuItemOnce, waitForSheetGone} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {secondSender, throwawayChannels} from '../helpers/chat-host'
import {masked} from '../helpers/teams'

const START = 'keybase.1.SimpleFS.simpleFSStartDownload'
const DISMISS = 'keybase.1.SimpleFS.simpleFSDismissDownload'
const CHAT_DOWNLOAD = 'chat.1.local.DownloadFileAttachmentLocal'

// the menu's Save item while its download runs (its icon, then "In progress", then the title)
const SAVE_IN_PROGRESS = 'In progress, Save'
// a noise png of this side is about 43 MB: under the 50 MB the phone asks to confirm a save at, and
// its download runs for seconds
const LARGE_SIDE = 3800
// how long after a cancel the library is read for a save landing late
const LATE_SAVE_MS = 5_000
// the photos and videos of the corpus, all in the library of the gate's phone
const CORPUS_MEDIA = CORPUS.filter(c => c.kind === 'image' || c.kind === 'video').length

describe('save to photos', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   grant     grantPrivacy 640 each (the TCC read 15, the runtime 1, a checkpoint 60, simctl 120, the
  //             kill watch 15 overrun by one pid read 120, the launch: simctl 120, the runtime 120,
  //             the captures 4, a checkpoint 60), two 1280;  full  grantFullPhotoAccess 60 (the read
  //             25, the ask 35: 30 and its pause and resume, the prompt 20 and its tap 1 inside it)
  //   access    fullPhotoAccess 1391 (the grants 1280, full 60, two reads 50 a second
  //             apart 1);  absent  the library read for a late save: 5s of reads, overrun by one 25
  //             and its info 25 = 56
  //   ask       one ask of the phone 25 (20, the pause and resume);  saved  the new asset, 30s of
  //             asks overrun by one 55, its info 25 = 80;  delete  deleteSavedPhoto 60 (the delete
  //             35, the read 25)
  //   work      the host's mkdir of the work folder 60, and 60 for the file it puts in it;  large
  //             the noise png made and written 10
  //   open      openFolder of a work folder 365 (the root 56, the type row 31, its tap 1 and screen
  //             11, then two levels of the row 121, its tap 1 and screen 11);  entry  the file's
  //             row 121 (120, one drag 1)
  //   menu      openRowMenu 52;  item  tapMenuItemOnce 2;  pin  one read 1;  in progress  10s of
  //             page sources, overrun by one 11;  gone  waitForSheetGone 6 (5, the bar read 1)
  //   calls     one read 2;  waited for  12 (10, one read 2), 32 (30, one read 2) for the save's end
  //   downloads 10s of asks overrun by one 35
  //   chat      the channel 240;  peer  the peer found 70;  send  90;  attach  60;  open
  //             openConversation 100;  landed  the row 60, then the attachment ready 60 = 120;  view
  //             scrollRowIntoView 30;  keyboard  5;  message menu  openMessageMenu 15 + chooseMenuItem
  //             20 = 35
  //   step      2 (its 1s settle and the attach)

  // -- what the afterEach puts back -----------------------------------------------------------------

  // the photo permissions the body changed: the restore of photos (a reset) goes first, then
  // photos-add's (granted again)
  let photos: PrivacyRestore | undefined
  let photosAdd: PrivacyRestore | undefined
  // the ids of the photos this run proved it saved and has not deleted yet, recorded when proven, and
  // the library's asset ids once the test had full access, before anything was saved
  const saved = new Set<string>()
  let libraryBefore: ReadonlySet<string> | undefined
  // the work folders the host made, the throwaway channel, and the local dir of the large file
  const madePaths = new Set<string>()
  const channel = throwawayChannels()
  const localDirs = new Set<string>()

  const SAVED_PHOTO = 'a photo this run saved'

  // The owner's instruction when a photo this run added is left: the ids, and how to find it by hand.
  const byHand = (ids: ReadonlyArray<string>) =>
    `delete the photo library asset(s) ${ids.join(', ')} that this run added (Photos > Recently Saved: a 64x48 or 3800x3800 image saved today), and no other photo`

  // Deletes exactly the ids recorded as proven saves; an asset new since the test began that was never
  // recorded is reported, never deleted. A delete that did not finish (cut off by its attempt's end
  // too) reads the library again and poisons the gate unless nothing this run added is left; the
  // library from before stays the earliest unfinished test's, so a retry's delete covers what an
  // earlier attempt left. Bound: ask 25, delete 60 a photo (one at most), the read again 25.
  const deleteSaved = async () => {
    const before = libraryBefore
    if (!before) return
    let left: Array<string> = [...saved]
    const leftNow = async () => {
      const plan = cleanupPlan(saved, before, await libraryAssetIds())
      left = [...plan.toDelete, ...plan.unrecorded]
      return plan
    }
    await guarded(
      SAVED_PHOTO,
      () => byHand(left),
      async () => {
        const plan = await leftNow()
        for (const id of plan.toDelete) {
          await deleteSavedPhoto(id, before)
          saved.delete(id)
          left = left.filter(l => l !== id)
        }
        if (plan.unrecorded.length) throw new Error(`the photo library holds ${plan.unrecorded.length} asset(s) new since the test began that it never recorded as saved: not deleted`)
      },
      async () => {
        await leftNow()
        return left.length > 0
      }
    )
    saved.clear()
    libraryBefore = undefined
  }

  // restorePrivacy reads each back, waits out the kill a photos reset brings (so launchIfGone, next,
  // brings the app back after it) and poisons the gate itself. Bound: two restores 582.
  const putBackPrivacy = async () => {
    try {
      if (photos) await restorePrivacy(photos)
      photos = undefined
    } finally {
      if (photosAdd) await restorePrivacy(photosAdd)
      photosAdd = undefined
    }
  }

  // Bound: 195 a folder (its listing 60, whoami 15, the delete 60, the listing 60).
  const removeMadePaths = async () => {
    for (const p of [...madePaths]) {
      await removeOwnKbfs(p)
      madePaths.delete(p)
    }
  }

  // Bound: delete 120.
  const deleteChannel = async () => masked(channel.deleteAll)

  const removeLocalDirs = () => {
    for (const d of [...localDirs]) {
      fs.rmSync(d, {force: true, recursive: true})
      localDirs.delete(d)
    }
  }

  // The chat test needs the second account unblocked, and its membership of the e2e team's channels
  // seeded. Worst case (s): seeding 20 minutes on a first run, the block check 75.
  before(async function () {
    this.timeout(20 * 60_000 + 100_000)
    await ensureChatData()
    await requireSecondNotBlocked()
  })

  // Worst case (s): the menu 19, ask 25, the saved photos 60 each (one at most), the read again 25,
  // privacy 582, launchIfGone 272, a folder 195, the channel 120, escapeToTabs 30 = 1328.
  afterEach(async function () {
    this.timeout(1_340_000)
    await withCleanup(closeMessageMenu, [deleteSaved, putBackPrivacy, launchIfGone, removeMadePaths, deleteChannel, removeLocalDirs, escapeToTabs])
  })

  // -- helpers --------------------------------------------------------------------------------------

  // Both photo permissions taken (their restores kept), then full access; answers the library's asset
  // ids then, read twice a second apart and proven a whole read (requireWholeLibraryRead) holding at
  // least the corpus (its photos and videos, as ensurePhotoCorpus adds them). Bound: two grants 1280,
  // full 60, two asks 50 and the second 1 = 1391.
  const fullPhotoAccess = async () => {
    photosAdd = await grantPrivacy('photos-add')
    photos = await grantPrivacy('photos')
    await grantFullPhotoAccess()
    const first = await libraryAssetIds()
    await new Promise(resolve => setTimeout(resolve, 1_000))
    const before = requireWholeLibraryRead(first, await libraryAssetIds(), CORPUS_MEDIA)
    libraryBefore ??= before
    return before
  }

  // The asset a save added, once the library holds one it did not hold `before`, proven the one saved
  // image of `pixels` and only then recorded as this run's. Bound: saved 55, ask 25 = 80.
  const savedImage = async (before: ReadonlySet<string>, what: string, pixels: string) => {
    const added = await waitFor(
      what,
      async () => {
        const ids = newAssetIds([...before], await libraryAssetIds())
        return ids.length ? ids : undefined
      },
      {interval: 1_000, timeout: 30_000}
    )
    const [first] = added
    const id = requireSavedImage(added, added.length === 1 && first ? await assetInfo(first) : undefined, pixels)
    saved.add(id)
    return id
  }

  // Deletes the photo this run saved and reads the library back to its ids from before the save.
  // Bound: delete 60, ask 25 = 85.
  const deleteAndReadBack = async (id: string, before: ReadonlySet<string>) => {
    await deleteSavedPhoto(id, before)
    saved.delete(id)
    check(!newAssetIds([...before], await libraryAssetIds()).length, 'the photo library holds an asset it did not before the test, after the delete')
  }

  // A work folder of this test with `file` in it under a stamped name, open on the phone with its row
  // drawn. Bound: work 120, open 365, entry 121 = 606.
  const folderWith = async (file: string, label: string) => {
    const folder = newWorkFolder()
    madePaths.add(folder)
    await kbfsMkdir(folder)
    const name = stampedEntry(label)
    await kbfsCopyIn(file, `${folder}/${name}.png`)
    await openFolder(folder, 120_000)
    await filesRowNamed(name, 'the image the host put in the work folder', {timeout: 120_000})
    return {folder, name}
  }

  // Refuses, before Save, unless the screen up is the work folder and the menu is the file's. Bound:
  // pin 1.
  const requireOnFolder = async (folder: string) => {
    const s = await visibleScreen()
    check(s?.name === 'fsBrowse' && s.params?.['path'] === folder && requireOwnPath(folder) === folder, 'the Save is not aimed inside the work folder: not tapping')
  }

  // -- tests ----------------------------------------------------------------------------------------

  it("an image in Files saved to Photos from its row's menu, then deleted by its id", async function () {
    // worst case (s): access 1391, work 120, open 365, entry 121, step 2, menu 52, pin 1, calls 2, item
    // 2, waited for 12, the save's end 32, gone 6, saved 80, step 2, delete 60, ask 25, step 2 = 2275
    this.timeout(2_305_000)
    const before = await fullPhotoAccess()
    const {folder, name} = await folderWith(corpusEntry('e2e-c.png').file, 'save')
    await step('The image in the work folder')

    await openRowMenu(name, 'the image row')
    await requireOnFolder(folder)
    const seq = await currentCallSeq()
    await tapMenuItemOnce('Save')
    await waitForUiCall('the save to start its download', seq, START)
    // the photo is saved before the download is dismissed, and the sheet then closes itself
    await waitForUiCall('the saved download to be dismissed', seq, DISMISS, {timeout: 30_000})
    await waitForSheetGone(5_000)
    const id = await savedImage(before, 'the saved image in the photo library', imageProps(corpusEntry('e2e-c.png').file).pixels)
    await step('The image saved to Photos', {card: true})

    await deleteAndReadBack(id, before)
    await step('The saved photo deleted again')
  })

  it("a large image's save in Files cancelled from the menu's Close while it downloads saves nothing", async function () {
    // worst case (s): access 1391, large 10, work 120, open 365, entry 121, step 2, downloads 25, menu
    // 52, pin 1, calls 2, item 2, waited for 12, in progress 11, downloads 25, the sheet 1, item 2,
    // waited for 12, gone 6, downloads 35, absent 56, calls 2, step 2 = 2255
    this.timeout(2_285_000)
    const before = await fullPhotoAccess()
    const dir = path.join('/tmp/kb-e2e', `media-${e2eRunId()}`)
    localDirs.add(dir)
    fs.mkdirSync(dir, {mode: 0o700, recursive: true})
    const local = path.join(dir, 'large.png')
    fs.writeFileSync(local, noisePng(LARGE_SIDE, LARGE_SIDE, randomBytes), {flag: 'wx', mode: 0o600})
    const {folder, name} = await folderWith(local, 'savebig')
    removeLocalDirs()
    await step('The large image in the work folder')
    const downloadsBefore = new Set((await phoneDownloads()).map(d => d.downloadID))

    await openRowMenu(name, 'the large image row')
    await requireOnFolder(folder)
    const seq = await currentCallSeq()
    await tapMenuItemOnce('Save')
    await waitForUiCall('the save to start its download', seq, START)
    // the menu's Save item reads in progress while the download runs
    await waitFor(
      "the menu's Save in progress",
      async () =>
        sourceElements(await browser.getPageSource()).some(e => e.attrs['label'] === SAVE_IN_PROGRESS) ? true : undefined,
      {interval: 250, timeout: 10_000}
    )
    // the save's download is still running as Close is tapped: a cancel, not a finished save dismissed
    const running = (await phoneDownloads()).filter(d => !downloadsBefore.has(d.downloadID))
    check(running.length === 1 && !running[0]!.done && !running[0]!.canceled, "the save's download is not running as Close is tapped")
    check(await (await menuSheet()).isExisting(), 'the menu sheet closed before its Close was tapped')
    await tapMenuItemOnce('Close')
    await waitForUiCall('the cancelled download to be dismissed', seq, DISMISS)
    await waitForSheetGone(5_000)
    // the service holds no download of the save any more (a dismissed one is gone), and with the sheet
    // gone nothing is left to save it: the anchors of the library holding no new asset
    await waitFor(
      'the cancelled download to leave the phone service',
      async () => ((await phoneDownloads()).every(d => downloadsBefore.has(d.downloadID)) ? true : undefined),
      {interval: 1_000, timeout: 10_000}
    )
    // read over a few seconds, not once: a save lands only after its download, in the app
    const deadline = Date.now() + LATE_SAVE_MS
    for (;;) {
      const added = newAssetIds([...before], await libraryAssetIds())
      if (added.length) {
        // the large image itself is this run's own save, recorded so the afterEach deletes it
        const [first] = added
        if (added.length === 1 && first) {
          const info = await assetInfo(first)
          if (info.mediaType === 'image' && info.width === LARGE_SIDE && info.height === LARGE_SIDE) saved.add(first)
        }
        throw new Error('a photo was saved after the save was cancelled')
      }
      if (Date.now() > deadline) break
      await new Promise(resolve => setTimeout(resolve, 1_000))
    }
    check((await uiCallCount(seq, START)) === 1, 'the cancelled save started more than one download')
    await step('The save cancelled: nothing saved', {card: true})
  })

  it('an image the second account attaches in chat saved to Photos from its message menu, then deleted by its id', async function () {
    // worst case (s): chat 240, peer 70, send 90, attach 60, access 1391, open 100, landed 120, the
    // check 1, view 30, keyboard 5, message menu 15, step 2, calls 2, message menu 20, waited for 32,
    // saved 80, step 2, delete 60, ask 25, step 2 = 2347
    this.timeout(2_375_000)
    const made = await masked(async () => channel.make('save'))
    await sendWithRetry(await secondSender(), made.convID, e2eMarker('save-hello'))
    const title = e2eMarker('save-img')
    await (await secondSender()).attach(made.convID, corpusEntry('e2e-c.png').file, title)
    // the grants relaunch the app: taken before the conversation opens
    const before = await fullPhotoAccess()

    await openConversation(made.convID)
    const ordinal = await waitForRow(title, 60_000)
    const a = await waitFor(
      `the attachment "${title}" to be ready`,
      async () => {
        const got = await storedAttachment(ordinal)
        if (!got) throw new Error(`row ${ordinal} is not an attachment`)
        return got.renderType === 'attachment:image' && got.id > 0 && !got.transferState && got.hasPreview ? got : undefined
      },
      {interval: 500, timeout: 60_000}
    )
    check(a.author === loadE2EEnv().secondUser, 'the image did not come from the second account')
    await scrollRowIntoView(ordinal)
    await hideKeyboard()

    await openMessageMenu(title)
    await step("The incoming image's menu")
    const seq = await currentCallSeq()
    await chooseMenuItem('Save')
    await waitForUiCall('the attachment to download for the save', seq, CHAT_DOWNLOAD, {timeout: 30_000})
    const id = await savedImage(before, 'the saved attachment in the photo library', imageProps(corpusEntry('e2e-c.png').file).pixels)
    await step('The attachment saved to Photos', {card: true})

    await deleteAndReadBack(id, before)
    await step('The saved photo deleted again')
  })
})
