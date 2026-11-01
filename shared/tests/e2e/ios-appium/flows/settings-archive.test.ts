// Backups made from the phone as the smoke account, one job per test: the self conversation's
// "Backup channel" (paused, resumed, paused again and cancelled from the Backup page), a folder's
// "Backup folder" from its files row menu (removed from the Backup page while it runs). The Backup
// page's "Backup all files" and "Backup all Git repos" are never pressed: they copy every folder and
// repo of the account, non-test teams' too, onto the phone, and the status lists only some of the
// jobs they start (census exclusions, manual-only 'backup-all').
//
// The jobs run on the phone's own service and write into the phone's storage (the phone has no
// destination to pick: its modal only shares), so they are read and cleaned up through the phone's
// own service (askApp), and what they wrote is looked for in the simulator's storage on this Mac,
// at the paths the service gives, which never leave memory. Each test's beforeEach snapshots the
// phone's jobs; its afterEach removes the jobs that are not in the snapshot (a chat job with its
// output), reads back that they are gone and that nothing they wrote is left, and never touches a
// job from before. A cleanup that fails stops the whole gate (gate/poison-lib.ts): a job left
// running would go on filling the phone.
//
// The folder to back up is made by the host, stamped, inside a work folder of this run, and removed
// by the afterEach. The self conversation is found by its exact name through the host's CLI.
//
// Never pressed: Share (on a finished job, or its "..." menu), "Clear completed", "Backup all files",
// "Backup all Git repos".
import {randomBytes} from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {loadE2EAccounts} from '../../accounts/env'
import {directConvIDFromCli} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {kbfsCopyIn, kbfsMkdir, newWorkFolder, removeOwnKbfs, requireOwnPath, stampedEntry} from '../../shared/files.ts'
import * as T from '../../shared/test-ids'
import {archiveJobStates, archiveJobs, removeArchiveJobs, type ArchiveJobStates, type ArchiveJobs} from '../gate/app-ask'
import {
  anchorsOf,
  chatArchivesOf,
  CHAT_COMPLETE,
  CHAT_PAUSED,
  CHAT_RUNNING,
  KBFS_DONE,
  jobIDsOf,
  newJobIDs,
  outputPathsOf,
  simDataRoot,
  stillListed,
} from '../gate/archive-lib.ts'
import {requireCurrentAttempt} from '../gate/attempt'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {elementInRow, type Rect} from '../gate/chat-lib.ts'
import {clearGatePoison, poisonGate} from '../gate/poison-lib.ts'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {closeMessageMenu, dragUntilOnScreen, hideKeyboard, openConversation, openInfoPanel} from '../helpers/chat'
import {el} from '../helpers/elements'
import {BUTTONS, expectScreen, filesRowNamed, onScreen, openFolder, openRowMenu, press, tapButton, visibleScreen} from '../helpers/files'
import {appDataContainer, waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, dragBetween, elementWithLabelPart} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {masked} from '../helpers/teams'

const ARCHIVE_CHAT = 'chat.1.local.archiveChat'
const ARCHIVE_CHAT_PAUSE = 'chat.1.local.archiveChatPause'
const ARCHIVE_CHAT_RESUME = 'chat.1.local.archiveChatResume'
const ARCHIVE_CHAT_DELETE = 'chat.1.local.archiveChatDelete'
const ARCHIVE_START = 'keybase.1.SimpleFS.simpleFSArchiveStart'
const ARCHIVE_CANCEL = 'keybase.1.SimpleFS.simpleFSArchiveCancelOrDismissJob'

const ARCHIVE_TAB = 'settingsTabs.archiveTab'
// the phone's modal line, where a computer's offers a destination to save to
const SHARE_LINE = 'Share a copy of your content to another app'

const POISON = 'the backup jobs a backup test started on the phone'
const BY_HAND =
  "on the phone open More > Backup and remove every job the run started (never Share); in the simulator app's caches remove what a chat job left, its kbchat-<job id> folder and its kbchat-<job id>.tar.gzip file; then relaunch the app"

const plainJobID = /^[A-Za-z0-9_.:-]+$/

// the folder backup's file: 24 MB
const BIG_BYTES = 24 * 1024 * 1024

const STATIC_TEXT = (label: string) => `-ios predicate string:type == "XCUIElementTypeStaticText" AND label == ${JSON.stringify(label)}`

describe('settings archive', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   ask       an askApp 22 (20, the pause and resume 2);  polled  10s of asks overrun by one 32, 30s 52
  //   host      a host CLI read 60;  mkdir  60;  copy  60
  //   open      openConversation 100;  panel  openInfoPanel with a tab 25;  drag  dragUntilOnScreen 20
  //   folder    openFolder of a work folder 365 (the root 99, then two levels of the row 121, its tap
  //             1 and screen 11);  entry  a row that may arrive late 121;  menu  openRowMenu 52;  item
  //             chooseMenuItem 22
  //   button    tapButton 6;  label  a labelled element read 1;  screen  expectScreen 11, 16 with 15s
  //   calls     seq 2;  waited for  waitForCall 12
  //   page      the Backup page from See progress: screen 16, its marker 10 = 26
  //   row       a job's row 16 (15, one read 1);  in row  elementInRow 2 and its tap 1 = 3
  //   storage   the simulator's storage 120 (its container, once);  gone  20s of reads 21
  //   step      2 (its 1s settle and the attach)

  // -- what the afterEach cleans up ---------------------------------------------------------------

  // the phone's jobs before the test (kept until a cleanup reads back, so a cleanup that failed is
  // tried again against the same snapshot)
  let before: ArchiveJobs | undefined
  // what the test's jobs wrote on the phone, to be gone once they are
  const outputs = new Set<string>()
  // work folders the host made
  const madeFolders = new Set<string>()
  let storage: string | undefined

  // The simulator's own storage: the host only looks for a job's output inside it. Bound: storage 120.
  const storageRoot = () => {
    if (storage) return storage
    try {
      storage = simDataRoot(appDataContainer())
      return storage
    } catch (e) {
      if (isAttemptOver(e)) throw e
      // no cause: the error names the container's path
      // eslint-disable-next-line preserve-caught-error
      throw new Error("finding the simulator's storage failed")
    }
  }

  // Remembers what the jobs `ids` of `states` write. Bound: storage 120.
  const rememberOutputs = (states: ArchiveJobStates, ids: ArchiveJobs) => {
    for (const p of outputPathsOf(states, ids, storageRoot())) outputs.add(p)
  }

  // How many of the remembered outputs are on the phone, read in the simulator's storage on this Mac.
  // Bound: one read 1.
  const outputsLeft = () => {
    requireCurrentAttempt()
    return [...outputs].filter(p => fs.existsSync(p)).length
  }

  // Every remembered output there, or the folder it is made in, so a later "gone" read means it was
  // removed. Bound: one read 1.
  const outputsAnchored = (what: string) => {
    requireCurrentAttempt()
    const root = storageRoot()
    check([...outputs].every(p => anchorsOf(p, root).some(a => fs.existsSync(a))), `${what}: a backup output and the folder it is made in are both missing on the phone`)
  }

  // Deletes the compressed file a finished chat job of `fresh` left (the service's delete removes only
  // the job's folder), once it is checked to be a plain file inside the simulator. Bound: one read 1.
  const removeChatArchives = (states: ArchiveJobStates, fresh: ArchiveJobs) => {
    requireCurrentAttempt()
    for (const file of chatArchivesOf(states, fresh, storageRoot())) {
      const st = fs.lstatSync(file, {throwIfNoEntry: false})
      if (!st) continue
      check(st.isFile() && !st.isSymbolicLink(), "refusing to delete a finished chat backup's file: it is not a plain file")
      fs.unlinkSync(file)
    }
  }

  // Deletes the folder a removed chat job of `fresh` still left, once it is checked to be a plain
  // folder inside the simulator. A job removed while it runs can write after the service's own delete
  // (go/chat/archive.go Delete; seen live: a folder left 20s after the cleanup). Bound: one read 1.
  const removeChatFolders = (states: ArchiveJobStates, fresh: ArchiveJobs) => {
    requireCurrentAttempt()
    const root = storageRoot()
    for (const id of fresh.chat) {
      const j = states.chat.find(c => c.id === id)
      if (!j) continue
      anchorsOf(j.outputPath, root)
      const st = fs.lstatSync(j.outputPath, {throwIfNoEntry: false})
      if (!st) continue
      check(st.isDirectory() && !st.isSymbolicLink(), "refusing to delete a chat backup's output: it is not a plain folder")
      fs.rmSync(j.outputPath, {force: true, recursive: true})
    }
  }

  // Waits for nothing the test's jobs wrote to be left (a chat job's output is deleted in the
  // background). Bound: gone 21.
  const outputsGone = async (what: string) =>
    waitFor(what, () => (outputsLeft() === 0 ? true : undefined), {interval: 500, timeout: 20_000})

  // The jobs that are not in the snapshot removed, read back gone, a finished chat job's compressed
  // file deleted, and nothing they wrote left (a chat job's folder the service left is deleted too).
  // Bound: ask 22, storage 120, the anchor 1, the remove 22, ask 22, the file 1, gone 22 = 210.
  const cleanUpJobs = async () => {
    const snapshot = before
    if (!snapshot) return
    try {
      const states = await archiveJobStates()
      const fresh = newJobIDs(jobIDsOf(states), snapshot)
      rememberOutputs(states, fresh)
      // the jobs go even when the anchor read fails: a job left running fills the phone (seen live:
      // a failed anchor once left a whole-files backup copying)
      let unanchored: Error | undefined
      try {
        outputsAnchored('before the cleanup')
      } catch (e) {
        if (isAttemptOver(e)) throw e
        unanchored = e instanceof Error ? e : new Error(String(e))
      }
      await removeArchiveJobs(fresh, snapshot)
      if (unanchored) throw unanchored
      // the answer lists the phone's jobs, so a job missing from it is gone
      check(stillListed(await archiveJobs(), fresh) === 0, "a backup job the test started is still on the phone after the cleanup")
      removeChatArchives(states, fresh)
      // the service deletes a chat job's folder in the background; what it left is deleted here
      await waitFor("the test's backup output removed from the phone", () => {
        if (outputsLeft() === 0) return true
        removeChatFolders(states, fresh)
        return undefined
      }, {interval: 2_000, timeout: 20_000})
      outputs.clear()
      before = undefined
      clearGatePoison(POISON)
    } catch (e) {
      poisonGate(POISON, BY_HAND)
      throw e
    }
  }

  // Bound: 195 a folder (its listing 60, whoami 15, the delete 60, the listing 60).
  const removeMadeFolders = async () => {
    for (const f of [...madeFolders]) {
      await masked(async () => removeOwnKbfs(f))
      madeFolders.delete(f)
    }
  }

  // Bound: ask 22.
  beforeEach(async function () {
    this.timeout(60_000)
    before ??= await archiveJobs()
  })

  // Worst case (s): the menu 19, the keyboard 5, cleanUpJobs 210, a folder 195, the sheet 7,
  // escapeToTabs 30 = 466.
  afterEach(async function () {
    this.timeout(490_000)
    // the jobs first: one left running fills the phone
    await withCleanup(cleanUpJobs, [closeMessageMenu, hideKeyboard, removeMadeFolders, leaveBackupSheet, escapeToTabs])
  })

  // -- reads ----------------------------------------------------------------------------------------

  // The one new job of `kind` the test's tap made, once the phone's service lists it, with what it
  // writes remembered. Bound: polled 32, storage 120 = 152.
  const newJob = async (kind: 'chat' | 'kbfs', what: string) => {
    const snapshot = before
    if (!snapshot) throw new Error("the phone's backup jobs were never read before the test")
    const {id, states} = await waitFor(
      what,
      async () => {
        const states = await archiveJobStates()
        const fresh = newJobIDs(jobIDsOf(states), snapshot)
        const other = kind === 'chat' ? fresh.kbfs : fresh.chat
        check(other.length === 0, `${what}: a backup job of another kind was made too`)
        const mine = fresh[kind]
        check(mine.length <= 1, `${what}: ${mine.length} new backup jobs, not one`)
        return mine[0] === undefined ? undefined : {id: mine[0], states}
      },
      {interval: 500, timeout: 10_000}
    )
    check(plainJobID.test(id), `${what}: the job's id is not plain`)
    rememberOutputs(states, kind === 'chat' ? {chat: [id], kbfs: []} : {chat: [], kbfs: [id]})
    return id
  }

  // Bound: ask 22.
  const chatStatus = async (id: string) => (await archiveJobStates()).chat.find(j => j.id === id)?.status
  const kbfsPhase = async (id: string) => (await archiveJobStates()).kbfs.find(j => j.id === id)?.phase

  // Waits for the phone's service to no longer list the job. Bound: polled 32.
  const jobGone = async (id: string, what: string) =>
    waitFor(
      what,
      async () => {
        const now = await archiveJobs()
        return stillListed(now, {chat: [id], kbfs: [id]}) === 0 ? true : undefined
      },
      {interval: 500, timeout: 10_000}
    )

  // -- the modal and the Backup page --------------------------------------------------------------

  // The phone's backup modal: its share line drawn on screen, and no destination to save to anywhere
  // in the tree. Over a files screen XCUITest reports the modal visible=false (seen live), so the
  // line's frame on screen stands for visible. Bound: the line 10 and its reads 1, two reads 2 = 13.
  const expectPhoneModal = async () => {
    await waitFor(
      "the backup modal's line",
      async () => {
        for (const e of await browser.$$(STATIC_TEXT(SHARE_LINE)).getElements()) if (await onScreen(e)) return true
        return undefined
      },
      {interval: 250, timeout: 10_000}
    )
    for (const label of ['Save To', 'Change']) {
      check((await browser.$$(STATIC_TEXT(label)).length) === 0, `the phone's backup modal offers "${label}"`)
    }
  }

  // The Backup page, current. Bound: screen 16, its marker 10 = 26.
  const expectBackupPage = async (what: string) => {
    await expectScreen(what, ARCHIVE_TAB, () => true, 15_000)
    await el(T.SETTINGS_ARCHIVE).waitForExist({timeout: 10_000})
  }

  // Closes the Backup page when it is up as a sheet (a backup modal's "See progress" opens it over the
  // conversation, with no Close or Cancel: a person swipes it down), so escapeToTabs, which knows no
  // swipe, finds a screen it can leave. A pushed Backup page takes no harm from the drag down its
  // header. Bound: the screen 1, the drag 1, the route leaving 5 = 7.
  const leaveBackupSheet = async () => {
    if ((await visibleScreen())?.name !== ARCHIVE_TAB) return
    const {height, width} = await browser.getWindowRect()
    await dragBetween({x: width / 2, y: 110}, {x: width / 2, y: height - 60}, 300)
    await waitFor('the Backup sheet to close', async () => ((await visibleScreen())?.name !== ARCHIVE_TAB ? true : undefined), {
      interval: 250,
      timeout: 5_000,
    }).catch((e: unknown) => {
      if (isAttemptOver(e)) throw e
    })
  }

  const rowOf = (id: string) => `${T.SETTINGS_ARCHIVE_ROW_PREFIX}${id}`

  // Where the job's row is drawn on the Backup page. Bound: row 16.
  const rowRect = async (id: string, what: string): Promise<Rect> => {
    const row = el(rowOf(id))
    await row.waitForExist({timeout: 15_000, timeoutMsg: `${what} is not listed on the Backup page`})
    return {...(await row.getLocation()), ...(await row.getSize())}
  }

  // Taps the control `testID` in the job's row and waits for `method` to go out. Bound: row 16, calls
  // 2, in row 3 and its press 1, waited for 12 = 34.
  const tapInRow = async (id: string, testID: string, method: string, what: string) => {
    const rect = await rowRect(id, 'the job')
    const seq = await currentCallSeq()
    // a frame tap when XCUITest reports the row's control visible=false (a click on one taps nothing)
    await press(await elementInRow(rect, testID), what)
    await waitForUiCall(`${what} to go out`, seq, method)
  }

  // The job's row gone from the Backup page, read on the page proven current. Bound: the page 26, 10s
  // of reads 11 = 37.
  const rowGone = async (id: string, what: string) => {
    await expectBackupPage(`the Backup page, for ${what}`)
    await el(rowOf(id)).waitForExist({reverse: true, timeout: 10_000, timeoutMsg: `${what} is still listed on the Backup page`})
  }

  // Taps the modal's Start and waits for `method`. Bound: calls 2, button 6, waited for 12 = 20.
  const start = async (method: string, what: string) => {
    const seq = await currentCallSeq()
    await tapButton('Start', "the backup modal's Start")
    await waitForUiCall(`${what} to go out`, seq, method)
  }

  // -- chat ---------------------------------------------------------------------------------------

  // Pauses the running chat job from its row. Pause is offered only while the job runs, so one that
  // finished first fails here. Bound: polled 32, tapInRow 34, polled 52, the resume icon 16 and in row
  // 2, step 2 = 138.
  const pauseChatJob = async (id: string, what: string) => {
    const status = await waitFor(
      `the chat backup running ${what}`,
      async () => {
        const s = await chatStatus(id)
        return s === CHAT_RUNNING || s === CHAT_COMPLETE ? s : undefined
      },
      {interval: 500, timeout: 10_000}
    )
    check(status !== CHAT_COMPLETE, `the chat backup finished ${what}, before it could be paused: the self conversation backs up too fast for this flow`)
    await tapInRow(id, T.SETTINGS_ARCHIVE_JOB_PAUSE, ARCHIVE_CHAT_PAUSE, 'the chat backup pause')
    await waitFor(`the chat backup paused ${what}`, async () => ((await chatStatus(id)) === CHAT_PAUSED ? true : undefined), {
      interval: 500,
      timeout: 30_000,
    })
    await elementInRow(await rowRect(id, 'the paused job'), T.SETTINGS_ARCHIVE_JOB_RESUME)
    await step(`Chat backup paused ${what}`)
  }

  it('the self conversation backed up from its info panel, paused, resumed, paused again and cancelled from the Backup page', async function () {
    // worst case (s): host 60, open 100, panel 25, drag 20, label 1 and its tap 1, screen 11, the
    // modal 13, step 2, start 20, newJob 152, button 6, page 26, row 16, step 2; pause 138, resume
    // (tapInRow 34), pause 138; cancel: the anchor 1, tapInRow 34, polled 32, rowGone 37, gone 21, step 2,
    // the sheet 7, its read 1 = 900
    this.timeout(920_000)
    const {smokeUser} = loadE2EAccounts()
    const convID = await masked(async () => directConvIDFromCli(smokeUser))
    await openConversation(convID)
    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    // the button's label holds its icon's glyph too
    const backup = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label CONTAINS "Backup channel" AND visible == 1')
    await dragUntilOnScreen('Backup channel', backup)
    await (await elementWithLabelPart(BUTTONS, 'Backup channel', "the info panel's Backup channel")).click()
    await expectScreen('the backup modal for the self conversation', 'archiveModal', p => p['type'] === 'chatID' && p['conversationIDKey'] === convID)
    await expectPhoneModal()
    await step('The backup modal for the self conversation')

    await start(ARCHIVE_CHAT, 'the chat backup')
    const id = await newJob('chat', 'the chat backup job on the phone')
    await tapButton('See progress', "the backup modal's See progress")
    await expectBackupPage('the Backup page from See progress')
    await rowRect(id, 'the chat backup')
    await step('The chat backup listed', {card: true})

    await pauseChatJob(id, 'after the start')
    await tapInRow(id, T.SETTINGS_ARCHIVE_JOB_RESUME, ARCHIVE_CHAT_RESUME, 'the chat backup resume')
    await pauseChatJob(id, 'after Resume')

    // Cancel on the paused job: Cancel deletes the output in the background, unordered with the job's
    // goroutine, and a running job's goroutine can still write a file after its context is cancelled
    // (go/chat/archive.go Delete), so the job is cancelled while paused, as on the computer.
    outputsAnchored('before the chat backup cancel')
    await tapInRow(id, T.SETTINGS_ARCHIVE_JOB_CANCEL, ARCHIVE_CHAT_DELETE, 'the chat backup cancel')
    await jobGone(id, 'the chat backup job gone from the phone after Cancel')
    await rowGone(id, 'the cancelled chat backup')
    await outputsGone('the chat backup output removed from the phone after Cancel')
    await step('Chat backup cancelled')
    // the Backup page is up as a sheet over the conversation: swiped down, as a person does
    await leaveBackupSheet()
    check((await visibleScreen())?.name !== ARCHIVE_TAB, 'the Backup sheet stayed up after a swipe down')
  })

  // -- files --------------------------------------------------------------------------------------

  it("a folder backed up from its files row menu, listed on the Backup page and removed there while it runs", async function () {
    // worst case (s): mkdir 60 x2, copy 60, folder 365, entry 121, the screen read 1, step 2, menu 52,
    // item 22, screen 11, the modal 13, step 2, start 20, newJob 152, button 6, page 26, row 16, ask
    // 22, step 2; remove: the anchor 1, tapInRow 34, polled 32, rowGone 37, gone 21, step 2 = 1140
    this.timeout(1_200_000)
    const work = newWorkFolder()
    madeFolders.add(work)
    await masked(async () => kbfsMkdir(work))
    const name = stampedEntry('backup')
    const folder = requireOwnPath(`${work}/${name}`)
    await masked(async () => kbfsMkdir(folder))
    // a file big enough that the phone is still downloading it when the Backup page reads the job (a
    // 64 KB folder was done by then, seen live): random, so nothing compresses it away
    const big = path.join(os.tmpdir(), `${stampedEntry('archive-data')}.bin`)
    fs.writeFileSync(big, randomBytes(BIG_BYTES), {mode: 0o600})
    try {
      await masked(async () => kbfsCopyIn(big, `${folder}/${stampedEntry('data')}`))
    } finally {
      fs.rmSync(big, {force: true})
    }

    await openFolder(work, 120_000)
    await filesRowNamed(name, 'the folder to back up', {timeout: 120_000})
    const s = await visibleScreen()
    check(s?.name === 'fsBrowse' && s.params?.['path'] === work, 'the files screen is not the work folder')
    await step('The folder to back up')
    await openRowMenu(name, 'the folder row')
    await chooseMenuItem('Backup folder')
    await expectScreen('the backup modal for the folder', 'archiveModal', p => p['type'] === 'fsPath' && p['path'] === folder)
    await expectPhoneModal()
    await step('The backup modal for the folder')

    await start(ARCHIVE_START, 'the folder backup')
    const id = await newJob('kbfs', 'the folder backup job on the phone')
    await tapButton('See progress', "the backup modal's See progress")
    await expectBackupPage('the Backup page from See progress')
    await rowRect(id, 'the folder backup')
    // a finished job offers only Share on the phone, so it must still be running to be removed
    check((await kbfsPhase(id)) !== KBFS_DONE, 'the folder backup finished before it could be removed: the folder backs up too fast for this flow')
    await step('The folder backup listed', {card: true})

    outputsAnchored('before the folder backup remove')
    await tapInRow(id, T.SETTINGS_ARCHIVE_KBFS_REMOVE, ARCHIVE_CANCEL, 'the folder backup remove')
    await jobGone(id, 'the folder backup job gone from the phone after its remove')
    await rowGone(id, 'the removed folder backup')
    await outputsGone('the folder backup output removed from the phone')
    await step('Folder backup removed')
  })
})
