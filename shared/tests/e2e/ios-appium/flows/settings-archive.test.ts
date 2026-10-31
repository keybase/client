// Backups made from the phone as the smoke account, one job per test: the self conversation's
// "Backup channel" (paused, resumed, paused again and cancelled from the Backup page), a folder's
// "Backup folder" from its files row menu (removed from the Backup page while it runs), and the
// Backup page's "Backup all files" and "Backup all Git repos" (cancelled the moment they start, so a
// whole-account download never fills the phone).
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
// Never pressed: Share (on a finished job, or its "..." menu), "Clear completed".
import * as fs from 'fs'
import {loadE2EAccounts} from '../../accounts/env'
import {CORPUS} from '../../fixtures/corpus/corpus'
import {directConvIDFromCli} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {kbfsCopyIn, kbfsMkdir, newWorkFolder, removeOwnKbfs, requireOwnPath, stampedEntry} from '../../shared/files.ts'
import * as T from '../../shared/test-ids'
import {archiveJobStates, archiveJobs, removeArchiveJobs, type ArchiveJobStates, type ArchiveJobs} from '../gate/app-ask'
import {
  CHAT_COMPLETE,
  CHAT_PAUSED,
  CHAT_RUNNING,
  KBFS_DONE,
  jobIDsOf,
  newJobIDs,
  outputPathsOf,
  simDataRoot,
  startedJobsOf,
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
import {BUTTONS, expectScreen, filesRowNamed, openFolder, openRowMenu, tapButton, visibleScreen} from '../helpers/files'
import {appDataContainer, waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, elementWithLabelPart} from '../helpers/menus'
import {escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {masked} from '../helpers/teams'

const ARCHIVE_CHAT = 'chat.1.local.archiveChat'
const ARCHIVE_CHAT_PAUSE = 'chat.1.local.archiveChatPause'
const ARCHIVE_CHAT_RESUME = 'chat.1.local.archiveChatResume'
const ARCHIVE_CHAT_DELETE = 'chat.1.local.archiveChatDelete'
const ARCHIVE_START = 'keybase.1.SimpleFS.simpleFSArchiveStart'
const ARCHIVE_ALL_FILES = 'keybase.1.SimpleFS.simpleFSArchiveAllFiles'
const ARCHIVE_ALL_GIT = 'keybase.1.SimpleFS.simpleFSArchiveAllGitRepos'
const ARCHIVE_CANCEL = 'keybase.1.SimpleFS.simpleFSArchiveCancelOrDismissJob'

const ARCHIVE_TAB = 'settingsTabs.archiveTab'
// the phone's modal line, where a computer's offers a destination to save to
const SHARE_LINE = 'Share a copy of your content to another app'

const POISON = 'the backup jobs a backup test started on the phone'
const BY_HAND = 'on the phone open More > Backup and remove every job the run started (never Share), then relaunch the app'

const plainJobID = /^[A-Za-z0-9_.:-]+$/

const bin = (() => {
  const entry = CORPUS.find(e => e.name === 'e2e-c.bin')
  if (!entry) throw new Error('the corpus has no binary file')
  return entry.file
})()

const STATIC_TEXT = (label: string) => `-ios predicate string:type == "XCUIElementTypeStaticText" AND label == ${JSON.stringify(label)} AND visible == 1`

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
  //   page      the Backup page from See progress: screen 16, its marker 10 = 26;  more  openBackup 97
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

  // Waits for nothing the test's jobs wrote to be left (a chat job's output is deleted in the
  // background). Bound: gone 21.
  const outputsGone = async (what: string) =>
    waitFor(what, () => (outputsLeft() === 0 ? true : undefined), {interval: 500, timeout: 20_000})

  // The jobs that are not in the snapshot removed, read back gone, and nothing they wrote left.
  // Bound: ask 22, storage 120, the remove 22, ask 22, gone 21 = 207.
  const cleanUpJobs = async () => {
    const snapshot = before
    if (!snapshot) return
    try {
      const states = await archiveJobStates()
      const fresh = newJobIDs(jobIDsOf(states), snapshot)
      rememberOutputs(states, fresh)
      await removeArchiveJobs(fresh, snapshot)
      // the answer lists the phone's jobs, so a job missing from it is gone
      check(stillListed(await archiveJobs(), fresh) === 0, "a backup job the test started is still on the phone after the cleanup")
      await outputsGone("the test's backup output removed from the phone")
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

  // Worst case (s): the menu 5, the keyboard 5, cleanUpJobs 207, a folder 195, escapeToTabs 30 = 442.
  afterEach(async function () {
    this.timeout(480_000)
    // the jobs first: one left running fills the phone
    await withCleanup(cleanUpJobs, [closeMessageMenu, hideKeyboard, removeMadeFolders, escapeToTabs])
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

  // The phone's backup modal: its share line drawn, and no destination to save to. Bound: the line
  // 10, two reads 2 = 12.
  const expectPhoneModal = async () => {
    await browser.$(STATIC_TEXT(SHARE_LINE)).waitForExist({timeout: 10_000, timeoutMsg: "the backup modal's line never showed"})
    for (const label of ['Save To', 'Change']) {
      check((await browser.$$(STATIC_TEXT(label)).length) === 0, `the phone's backup modal offers "${label}"`)
    }
  }

  // The Backup page, current. Bound: screen 16, its marker 10 = 26.
  const expectBackupPage = async (what: string) => {
    await expectScreen(what, ARCHIVE_TAB, () => true, 15_000)
    await el(T.SETTINGS_ARCHIVE).waitForExist({timeout: 10_000})
  }

  // The Backup page from the More list. Bound: escapeToTabs 30, the More tab 20, the row 25 and its
  // tap 1, the page 26 = 102.
  const openBackup = async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Backup')
    await expectBackupPage('the Backup page')
  }

  const rowOf = (id: string) => `${T.SETTINGS_ARCHIVE_ROW_PREFIX}${id}`

  // Where the job's row is drawn on the Backup page. Bound: row 16.
  const rowRect = async (id: string, what: string): Promise<Rect> => {
    const row = el(rowOf(id))
    await row.waitForExist({timeout: 15_000, timeoutMsg: `${what} is not listed on the Backup page`})
    return {...(await row.getLocation()), ...(await row.getSize())}
  }

  // Taps the control `testID` in the job's row and waits for `method` to go out. Bound: row 16, calls
  // 2, in row 3, waited for 12 = 33.
  const tapInRow = async (id: string, testID: string, method: string, what: string) => {
    const rect = await rowRect(id, 'the job')
    const seq = await currentCallSeq()
    await (await elementInRow(rect, testID)).click()
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
  // finished first fails here. Bound: polled 32, tapInRow 33, polled 52, the resume icon 16 and in row
  // 2, step 2 = 137.
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
    // modal 12, step 2, start 20, newJob 152, button 6, page 26, row 16, step 2; pause 137, resume
    // (tapInRow 33), pause 137; cancel: tapInRow 33, polled 32, rowGone 37, gone 21, step 2 = 886
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
    await tapInRow(id, T.SETTINGS_ARCHIVE_JOB_CANCEL, ARCHIVE_CHAT_DELETE, 'the chat backup cancel')
    await jobGone(id, 'the chat backup job gone from the phone after Cancel')
    await rowGone(id, 'the cancelled chat backup')
    await outputsGone('the chat backup output removed from the phone after Cancel')
    await step('Chat backup cancelled')
  })

  // -- files --------------------------------------------------------------------------------------

  it("a folder backed up from its files row menu, listed on the Backup page and removed there while it runs", async function () {
    // worst case (s): mkdir 60 x2, copy 60, folder 365, entry 121, the screen read 1, step 2, menu 52,
    // item 22, screen 11, the modal 12, step 2, start 20, newJob 152, button 6, page 26, row 16, ask
    // 22, step 2; remove: tapInRow 33, polled 32, rowGone 37, gone 21, step 2 = 1137
    this.timeout(1_200_000)
    const work = newWorkFolder()
    madeFolders.add(work)
    await masked(async () => kbfsMkdir(work))
    const name = stampedEntry('backup')
    const folder = requireOwnPath(`${work}/${name}`)
    await masked(async () => kbfsMkdir(folder))
    await masked(async () => kbfsCopyIn(bin, `${folder}/${stampedEntry('data')}`))

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

    await tapInRow(id, T.SETTINGS_ARCHIVE_KBFS_REMOVE, ARCHIVE_CANCEL, 'the folder backup remove')
    await jobGone(id, 'the folder backup job gone from the phone after its remove')
    await rowGone(id, 'the removed folder backup')
    await outputsGone('the folder backup output removed from the phone')
    await step('Folder backup removed')
  })

  // "Backup all files" or "Backup all Git repos" from the Backup page, cancelled the moment the modal
  // says the jobs started: the service makes every job before it answers, so the jobs it lists then
  // are all of them. Bound: more 102, step 2, button 6, screen 11, the modal 12, step 2, start 20, the
  // started line 60 and its read 1, ask 22, storage 120, the remove 22, polled 32, gone 21, step 2,
  // button 6, page 26, the rows 1 each, step 2 = 470 + the rows.
  const backupAll = async (button: string, type: 'fsAll' | 'gitAll', method: string, what: string) => {
    const snapshot = before
    if (!snapshot) throw new Error("the phone's backup jobs were never read before the test")
    await openBackup()
    await step('The Backup page')
    await tapButton(button, `the Backup page's ${button}`)
    await expectScreen(`the backup modal for ${what}`, 'archiveModal', p => p['type'] === type)
    await expectPhoneModal()
    await step(`The backup modal for ${what}`)

    await start(method, `the ${what} backup`)
    const line = await waitFor(
      `the modal to say how many ${what} jobs started`,
      async () => {
        const found = await browser.$$('-ios predicate string:type == "XCUIElementTypeStaticText" AND label BEGINSWITH "Started " AND visible == 1').getElements()
        check(found.length <= 1, `${found.length} started lines in the modal, not one`)
        return found[0] ? ((await found[0].getAttribute('label')) ?? undefined) : undefined
      },
      {interval: 250, timeout: 60_000}
    )
    // cancelled at once, before anything else, so the jobs download as little as they can
    const states = await archiveJobStates()
    const fresh = newJobIDs(jobIDsOf(states), snapshot)
    rememberOutputs(states, fresh)
    await removeArchiveJobs(fresh, snapshot)
    await waitFor(
      `the ${what} jobs gone from the phone`,
      async () => (stillListed(await archiveJobs(), fresh) === 0 ? true : undefined),
      {interval: 500, timeout: 10_000}
    )
    await outputsGone(`the ${what} backup output removed from the phone`)

    // checked once the jobs are gone, so a wrong count still leaves nothing running
    const started = startedJobsOf(line)
    check(started !== undefined, `the modal's started line for ${what} has no count`)
    check(started! > 0, `no ${what} job started: the smoke account has nothing for this backup to cover`)
    check(fresh.chat.length === 0, `the ${what} backup made a chat backup job`)
    check(fresh.kbfs.length === started, `the phone's service made ${fresh.kbfs.length} ${what} jobs, the modal says ${started}`)
    await step(`${what} backups started and cancelled`, {card: true})

    await tapButton('Close', "the backup modal's Close")
    await expectBackupPage('the Backup page after the modal')
    // read on the page proven current, which follows the phone's job notifications while it is up
    for (const id of fresh.kbfs) check(!(await el(rowOf(id)).isExisting()), `a cancelled ${what} job is still listed on the Backup page`)
    await step(`The Backup page after the ${what} backups`)
  }

  it('"Backup all files" started from the Backup page and cancelled at once', async function () {
    // worst case (s): backupAll 470 + a row read per job (well under 100 jobs) 100 = 570
    this.timeout(620_000)
    await backupAll('Backup all files', 'fsAll', ARCHIVE_ALL_FILES, 'all files')
  })

  it('"Backup all Git repos" started from the Backup page and cancelled at once', async function () {
    // worst case (s): backupAll 470 + a row read per job (well under 100 jobs) 100 = 570
    this.timeout(620_000)
    await backupAll('Backup all Git repos', 'gitAll', ARCHIVE_ALL_GIT, 'all Git repos')
  })
})
