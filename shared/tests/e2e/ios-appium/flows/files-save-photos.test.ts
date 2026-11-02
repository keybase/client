// Save to Photos from the phone: an image in Files saved from its row's menu, a large one whose save
// is cancelled from the menu's Close while it downloads, and an image the second account attaches in
// chat saved from its message menu. Each save is read back as the photo library's new newest asset,
// an image of the corpus png's pixel size, and deleted again by its exact id (iOS's own confirm
// tapped), read back gone; a cancelled save adds nothing. What a save added is the asset id the
// library did not hold before the test, not the newest by date: a saved file keeps its own date,
// which can tie with the corpus's.
//
// Saving to the library needs add access (granted already on the gate's phone) and the read-back and
// delete need full access, which a simctl grant does not give PhotoKit: the body takes both privacy
// tokens (grantPrivacy photos-add, then photos), then the app asks for full access and the system
// prompt's Allow Full Access is tapped. With full access the flow only reads the library's asset ids
// and deletes the ids it saved itself, never one the library held before the test. The afterEach deletes a photo a test
// saved and left, then puts both permissions back (photos reset, photos-add granted again: iOS keeps
// one of the two) and reads them back; either failing poisons the gate.
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
import {CORPUS} from '../../fixtures/corpus/corpus'
import {createThrowawayChannel, deleteThrowawayChannel, ensureChatData} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {kbfsCopyIn, kbfsMkdir, newWorkFolder, removeOwnKbfs, requireOwnPath, stampedEntry} from '../../shared/files.ts'
import {peerSender, sendWithRetry, type IncomingSender} from '../../shared/peer-actors'
import {e2eMarker, e2eRunId} from '../../shared/run-marker'
import {assetInfo, libraryAssetIds, phoneDownloads} from '../gate/app-ask'
import {requireSecondNotBlocked} from '../gate/blocks'
import {grantPrivacy, imageProps, launchIfGone, restorePrivacy} from '../gate/device'
import type {PrivacyRestore} from '../gate/device-lib'
import {sourceElements} from '../gate/page-source-lib.ts'
import {clearGatePoison, poisonGate} from '../gate/poison-lib.ts'
import {currentCallSeq, uiCallCount, waitForUiCall} from '../gate/recorder'
import {newAssetIds, noisePng, requireSavedImage} from '../gate/save-photos-lib.ts'
import {step} from '../gate/step'
import {deleteSavedPhoto, grantFullPhotoAccess} from '../gate/system-ui'
import {closeMessageMenu, hideKeyboard, openConversation, openMessageMenu, scrollRowIntoView, storedAttachment, waitForRow} from '../helpers/chat'
import {filesRowNamed, openFolder, openRowMenu, visibleScreen} from '../helpers/files'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, menuSheet, tapMenuItemOnce, waitForSheetGone} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {masked} from '../helpers/teams'

const START = 'keybase.1.SimpleFS.simpleFSStartDownload'
const DISMISS = 'keybase.1.SimpleFS.simpleFSDismissDownload'
const CHAT_DOWNLOAD = 'chat.1.local.DownloadFileAttachmentLocal'

// the menu's Save item while its download runs (its icon, then "In progress", then the title)
const SAVE_IN_PROGRESS = 'In progress, Save'
// a noise png of this side is about 43 MB: under the 50 MB the phone asks to confirm a save at, and
// its download runs for seconds
const LARGE_SIDE = 3800

const corpusPng = () => {
  const entry = CORPUS.find(c => c.name === 'e2e-c.png')
  if (!entry) throw new Error('the corpus has no e2e-c.png')
  return entry.file
}

describe('save to photos', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   grant     grantPrivacy 640 each (the TCC read 15, the runtime 1, a checkpoint 60, simctl 120, the
  //             kill watch 15 overrun by one pid read 120, the launch: simctl 120, the runtime 120,
  //             the captures 4, a checkpoint 60), two 1280;  full  grantFullPhotoAccess 35 (the ask
  //             30 and its pause and resume, the prompt 20 and its tap 1 inside it)
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
  // photos this run saved and has not deleted yet, and the library's asset ids once the test had
  // full access, before anything was saved: an asset not among them is the test's own
  const saved = new Set<string>()
  let libraryBefore: ReadonlySet<string> | undefined
  // the work folders the host made, the throwaway channel, and the local dir of the large file
  const madePaths = new Set<string>()
  let channel: string | undefined
  const localDirs = new Set<string>()

  // The second account's peer service, found once.
  let peer: Promise<IncomingSender> | undefined
  const sender = async () => (peer ??= peerSender(loadE2EEnv()))

  const SAVED_PHOTO = 'a photo this run saved'

  // A photo a test saved and did not get to read (it failed first) is an asset the library did not
  // hold in libraryBefore. Bound: ask 25, delete 60 a photo.
  const deleteSaved = async () => {
    try {
      const before = libraryBefore
      if (!before) return
      for (const id of newAssetIds([...before], await libraryAssetIds())) saved.add(id)
      for (const id of [...saved]) {
        await deleteSavedPhoto(id, before)
        saved.delete(id)
      }
    } catch (e) {
      poisonGate(SAVED_PHOTO, "delete the newest photo in the simulator's Photos, the one this run saved")
      throw e
    }
    libraryBefore = undefined
    clearGatePoison(SAVED_PHOTO)
  }

  // restorePrivacy reads each back and poisons the gate itself. Bound: two restores 300.
  const putBackPrivacy = () => {
    try {
      if (photos) restorePrivacy(photos)
      photos = undefined
    } finally {
      if (photosAdd) restorePrivacy(photosAdd)
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
  const deleteChannel = async () => {
    if (!channel) return
    const topicName = channel
    await masked(async () => deleteThrowawayChannel(topicName))
    channel = undefined
  }

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

  // Worst case (s): the menu 19, ask 25, the saved photos 60 each (one at most), privacy 300,
  // launchIfGone 272, a folder 195, the channel 120, escapeToTabs 30 = 1021.
  afterEach(async function () {
    this.timeout(1_060_000)
    await withCleanup(closeMessageMenu, [deleteSaved, putBackPrivacy, launchIfGone, removeMadePaths, deleteChannel, removeLocalDirs, escapeToTabs])
  })

  // -- helpers --------------------------------------------------------------------------------------

  // Both photo permissions taken (their restores kept), then full access; answers the library's asset
  // ids then. Bound: two grants 1280, full 35, ask 25 = 1340.
  const fullPhotoAccess = async () => {
    photosAdd = await grantPrivacy('photos-add')
    photos = await grantPrivacy('photos')
    await grantFullPhotoAccess()
    const before = new Set(await libraryAssetIds())
    libraryBefore = before
    return before
  }

  // The asset a save added, once the library holds one it did not hold `before`, kept as one this run
  // saved before it is checked, then proven the saved image. Bound: saved 55, ask 25 = 80.
  const savedImage = async (before: ReadonlySet<string>, what: string) => {
    const added = await waitFor(
      what,
      async () => {
        const ids = newAssetIds([...before], await libraryAssetIds())
        return ids.length ? ids : undefined
      },
      {interval: 1_000, timeout: 30_000}
    )
    for (const id of added) saved.add(id)
    const [first] = added
    return requireSavedImage(added, added.length === 1 && first ? await assetInfo(first) : undefined, imageProps(corpusPng()).pixels)
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
    // worst case (s): grant 1280, full 35, work 120, open 365, entry 121, step 2, ask 25, menu 52, pin
    // 1, calls 2, item 2, waited for 12, the save's end 32, gone 6, saved 80, step 2, delete 60, ask
    // 25, step 2 = 2224
    this.timeout(2_240_000)
    const before = await fullPhotoAccess()
    const {folder, name} = await folderWith(corpusPng(), 'save')
    await step('The image in the work folder')

    await openRowMenu(name, 'the image row')
    await requireOnFolder(folder)
    const seq = await currentCallSeq()
    await tapMenuItemOnce('Save')
    await waitForUiCall('the save to start its download', seq, START)
    // the photo is saved before the download is dismissed, and the sheet then closes itself
    await waitForUiCall('the saved download to be dismissed', seq, DISMISS, {timeout: 30_000})
    await waitForSheetGone(5_000)
    const id = await savedImage(before, 'the saved image in the photo library')
    await step('The image saved to Photos', {card: true})

    await deleteAndReadBack(id, before)
    await step('The saved photo deleted again')
  })

  it("a large image's save in Files cancelled from the menu's Close while it downloads saves nothing", async function () {
    // worst case (s): grant 1280, full 35, large 10, work 120, open 365, entry 121, step 2, ask 25,
    // downloads 25, menu 52, pin 1, calls 2, item 2, waited for 12, in progress 11, the sheet 1, item
    // 2, waited for 12, gone 6, downloads 35, ask 25, calls 2, step 2 = 2148
    this.timeout(2_180_000)
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
    const added = newAssetIds([...before], await libraryAssetIds())
    for (const id of added) saved.add(id)
    check(!added.length, 'a photo was saved after the save was cancelled')
    check((await uiCallCount(seq, START)) === 1, 'the cancelled save started more than one download')
    await step('The save cancelled: nothing saved', {card: true})
  })

  it('an image the second account attaches in chat saved to Photos from its message menu, then deleted by its id', async function () {
    // worst case (s): chat 240, peer 70, send 90, attach 60, grant 1280, full 35, open 100, landed 120,
    // the check 1, view 30, keyboard 5, ask 25, message menu 15, step 2, calls 2, message menu 20,
    // waited for 32, saved 80, step 2, delete 60, ask 25, step 2 = 2296
    this.timeout(2_320_000)
    const made = await masked(async () => createThrowawayChannel('save'))
    channel = made.topicName
    await sendWithRetry(await sender(), made.convID, e2eMarker('save-hello'))
    const title = e2eMarker('save-img')
    await (await sender()).attach(made.convID, corpusPng(), title)
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
    const id = await savedImage(before, 'the saved attachment in the photo library')
    await step('The attachment saved to Photos', {card: true})

    await deleteAndReadBack(id, before)
    await step('The saved photo deleted again')
  })
})
