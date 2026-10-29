// Backups: a chat backup of the self conversation (paused, resumed, paused, cancelled), a KBFS backup of one
// folder this run makes, and the "all files" and "all git repos" backups, each cancelled or
// dismissed from the Backup page. Every output goes under this run's own directory,
// /tmp/kb-e2e/archive-<runid>, which the destination dialog is stubbed to pick; jobs that were there
// before the flow are never touched.
import * as fs from 'fs'
import * as path from 'path'
import type {Locator, Page, TestInfo} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {openSelfConversation} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {kbfsCopyIn, kbfsMkdir, openKbfsFolder, pickFromRowMenu, removeOwnKbfs, smokeFolder, stampedEntry} from '@/tests/e2e/electron/helpers/files'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})
test.describe.configure({timeout: 180_000})

// -- the run's output directory --------------------------------------------------------------------

const runDir = () => `/tmp/kb-e2e/archive-${e2eRunId()}`
// /tmp is a link (to /private/tmp on macOS): the run directory's real path is the link's target
// joined with the rest, and nothing else
const runDirReal = () => path.join(fs.realpathSync('/tmp'), 'kb-e2e', `archive-${e2eRunId()}`)

const requireInRunDir = (p: string) => {
  if (fs.realpathSync(path.dirname(p)) !== fs.realpathSync(runDir()) && !fs.realpathSync(path.dirname(p)).startsWith(`${runDirReal()}/`)) {
    throw new Error(`refusing ${p}: not inside ${runDir()}`)
  }
}

// Removes one file a backup wrote, after checking it is a plain file inside the run directory.
const removeOutputFile = (p: string) => {
  if (!fs.existsSync(p)) return
  const st = fs.lstatSync(p)
  if (!st.isFile() || st.isSymbolicLink()) throw new Error(`refusing to delete ${p}: not a plain file`)
  requireInRunDir(p)
  fs.unlinkSync(p)
}

test.beforeAll(() => {
  fs.mkdirSync('/tmp/kb-e2e', {recursive: true})
  if (fs.existsSync(runDir())) throw new Error(`${runDir()} is already there: a run with this id left it`)
  fs.mkdirSync(runDir())
  if (fs.realpathSync(runDir()) !== runDirReal()) throw new Error(`${runDir()} resolves to ${fs.realpathSync(runDir())}`)
})

// The run directory and what is still in it, once its real path is checked to be exactly it.
test.afterAll(() => {
  if (!fs.existsSync(runDir())) return
  const real = fs.realpathSync(runDir())
  if (real !== runDirReal() || fs.lstatSync(runDir()).isSymbolicLink()) throw new Error(`refusing to remove ${runDir()}: it resolves to ${real}`)
  fs.rmSync(real, {recursive: true})
  expect(fs.existsSync(runDir()), `${runDir()} after the cleanup`).toBe(false)
})

// -- the archive modal and the Backup page ---------------------------------------------------------

// Picks `dest` as the modal's destination (through the stubbed save dialog) and starts the backup.
const startToDestination = async (page: Page, dest: string) => {
  await (await connectMainProcess()).stubSaveDialog(dest)
  await page.getByText('Change', {exact: true}).locator('visible=true').click()
  await expect(page.locator(`[title="${dest}"]`).locator('visible=true'), 'the destination shown in the modal').toBeVisible({timeout: 5_000})
  await page.getByText('Start', {exact: true}).locator('visible=true').click()
}

const archivePage = (page: Page) => page.getByTestId(T.SETTINGS_ARCHIVE).locator('visible=true')

// "See progress" pushes the Backup page over the settings nav. Pressing the Settings tab while it
// shows may or may not pop back to the nav, so a shown Backup page is used as it is, and otherwise
// the Settings tab is entered from another tab, which shows whichever of the two is on top.
const openArchivePage = async (page: Page) => {
  if (await archivePage(page).isVisible()) return
  await navigateToPeople(page)
  await page.getByTestId(T.NAV_TAB_SETTINGS).click()
  const nav = page.getByTestId(T.SETTINGS_ACCOUNT).locator('visible=true')
  await expect(archivePage(page).or(nav), 'the Settings tab').toBeVisible({timeout: 5_000})
  if (!(await archivePage(page).isVisible())) await nav.locator('text=Backup').first().click()
  await expect(archivePage(page)).toBeVisible({timeout: 10_000})
}

// The job row naming `label` (a KBFS path or git repo), with its Cancel or Dismiss.
const kbfsJobRow = (page: Page, label: string) =>
  archivePage(page)
    .locator('div')
    .filter({has: page.getByText(label, {exact: true})})
    .filter({has: page.getByText(/^(Cancel|Dismiss)$/)})
    .last()

// -- chat ------------------------------------------------------------------------------------------

type ChatJob = {request: {jobID: string; outputPath: string}; status: number}
const chatStatus = {complete: 4, paused: 1, running: 0} as const
const chatJob = async (outputPath: string) =>
  (await mainRpc<{jobs?: Array<ChatJob> | null}>('chat.1.local.archiveChatList', {identifyBehavior: 0})).jobs?.find(j => j.request.outputPath === outputPath)

// Pauses the chat backup job from its row. Pause is offered only while the job runs, so one that
// already finished fails here.
const pauseChatJob = async (page: Page, testInfo: TestInfo, row: Locator, out: string, what: string) => {
  let before: number | undefined
  await expect
    .poll(
      async () => {
        before = (await chatJob(out))?.status
        return before === chatStatus.running || before === chatStatus.complete
      },
      {message: `the chat backup running (or already finished) ${what}`, timeout: 10_000}
    )
    .toBe(true)
  if (before === chatStatus.complete) {
    throw new Error(`the chat backup finished ${what}, before it could be paused: the self conversation archives too fast for this flow`)
  }
  await row.getByText('Pause', {exact: true}).click({timeout: 5_000})
  await expect.poll(async () => (await chatJob(out))?.status, {message: `the chat backup paused ${what}`, timeout: 10_000}).toBe(chatStatus.paused)
  await expect(row.getByText('Resume', {exact: true}), 'the paused job offers Resume').toBeVisible()
  await step(page, testInfo, `chat backup paused ${what}`)
}

// Paused, resumed, paused again and cancelled. Cancel deletes the output in the background,
// unordered with the job's goroutine (go/chat/archive.go Delete), and that goroutine can still
// create files after its context is cancelled (archiveConv opens each attachment file before the
// download sees the cancel). Cancelling while paused only narrows that window: Pause marks the job
// PAUSED without waiting for its goroutine to exit, so a goroutine still unwinding from the second
// pause can recreate an attachment file after the delete, and the read-back of the output then
// fails. What this covers: Cancel on a paused job removes it from the list and, nearly always, its
// output. What it does not: Cancel on a running job (the usual case), which has no e2e test while
// the service's race stands.
test('chat backup of the self conversation: pause, resume, cancel', async ({page}, testInfo) => {
  const {smokeUser} = loadE2EAccounts()
  const out = path.join(runDir(), 'chat')
  await withCleanup(
    async () => {
      await openSelfConversation(page, smokeUser)
      const infoPanel = page.getByTestId(T.CHAT_INFO_PANEL)
      if (!(await infoPanel.isVisible())) await page.locator('.icon-gen-iconfont-info:visible').first().click()
      await infoPanel.getByTestId(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
      await infoPanel.getByText('Backup channel', {exact: true}).click()
      await expect(page.getByText(`Source: Chat conversation: ${smokeUser}`, {exact: true}), 'the backup modal for the self conversation').toBeVisible({timeout: 10_000})
      await startToDestination(page, out)
      await expect.poll(async () => (await chatJob(out))?.status, {message: 'the chat backup job on the service', timeout: 10_000}).toBeDefined()
      await page.getByText('See progress', {exact: true}).locator('visible=true').click()
      await expect(archivePage(page), 'the Backup page').toBeVisible({timeout: 10_000})
      await step(page, testInfo, 'backup page')
      // the job's row: its context line carries the output (the compressed file) in its title
      const row = archivePage(page)
        .locator('div')
        .filter({has: page.locator(`[title$=" => ${out}.tar.gzip"]`)})
        .filter({has: page.getByText('Cancel', {exact: true})})
        .last()
      await expect(row, 'the running chat backup listed').toBeVisible({timeout: 10_000})
      await step(page, testInfo, 'chat backup listed', {card: true})
      await pauseChatJob(page, testInfo, row, out, 'after the start')
      await row.getByText('Resume', {exact: true}).click()
      await pauseChatJob(page, testInfo, row, out, 'after Resume')
      await row.getByText('Cancel', {exact: true}).click({timeout: 5_000})
      await expect.poll(async () => chatJob(out), {message: 'the chat backup job after Cancel', timeout: 10_000}).toBeUndefined()
      await expect(row, 'the cancelled job off the Backup page').toHaveCount(0, {timeout: 10_000})
      // the cancel deletes the job's output
      await expect.poll(() => fs.existsSync(out) || fs.existsSync(`${out}.tar.gzip`), {message: 'the chat backup output after Cancel', timeout: 10_000}).toBe(false)
      await step(page, testInfo, 'chat backup cancelled')
    },
    [
      async () => {
        const job = await chatJob(out)
        if (job) await mainRpc('chat.1.local.archiveChatDelete', {deleteOutputPath: true, identifyBehavior: 0, jobID: job.request.jobID})
        expect(await chatJob(out), 'the chat backup job after the cleanup').toBeUndefined()
      },
    ]
  )
})

// -- KBFS ------------------------------------------------------------------------------------------

type KbfsJob = {desc: {gitRepo?: string | null; jobID: string; kbfsPathWithRevision: {path: string}; zipFilePath: string}; phase: number}
const kbfsJobs = async () => (await mainRpc<{jobs?: Array<KbfsJob> | null}>('keybase.1.SimpleFS.simpleFSGetArchiveStatus', {})).jobs ?? []
// this run's jobs: the ones writing under `dir` or to `dir` itself
const ownKbfsJobs = async (dest: string) => (await kbfsJobs()).filter(j => j.desc.zipFilePath === dest || j.desc.zipFilePath.startsWith(`${dest}/`))

// Cancels or dismisses each of this run's jobs from its row, and reads back that the service has
// none left; the zips they wrote are removed one by one.
const cancelOwnJobsInApp = async (page: Page, testInfo: TestInfo, dest: string) => {
  const jobs = await ownKbfsJobs(dest)
  expect(jobs.length, `backup jobs writing to ${dest}`).toBeGreaterThan(0)
  await openArchivePage(page)
  for (const job of jobs) {
    const label = job.desc.gitRepo ?? job.desc.kbfsPathWithRevision.path
    const row: Locator = kbfsJobRow(page, label)
    await expect(row, `the job for ${label} listed`).toBeVisible({timeout: 15_000})
    await row.getByText(/^(Cancel|Dismiss)$/).click()
    await expect.poll(async () => (await kbfsJobs()).some(j => j.desc.jobID === job.desc.jobID), {message: `the job for ${label} after Cancel or Dismiss`, timeout: 20_000}).toBe(false)
  }
  await expect.poll(async () => (await ownKbfsJobs(dest)).length, {message: `backup jobs writing to ${dest} left`, timeout: 10_000}).toBe(0)
  await step(page, testInfo, 'backup jobs cancelled or dismissed')
  for (const job of jobs) removeOutputFile(job.desc.zipFilePath)
}

const cancelOwnJobs = async (dest: string) => {
  for (const job of await ownKbfsJobs(dest)) await mainRpc('keybase.1.SimpleFS.simpleFSArchiveCancelOrDismissJob', {jobID: job.desc.jobID})
  expect((await ownKbfsJobs(dest)).length, `backup jobs writing to ${dest} after the cleanup`).toBe(0)
}

test('KBFS backup of one folder', async ({page}, testInfo) => {
  const name = stampedEntry('archsrc')
  const folder = `${smokeFolder()}/${name}`
  const dest = path.join(runDir(), `${name}.zip`)
  await withCleanup(
    async () => {
      // setup through the CLI: a folder with one file in it
      const src = path.join(runDir(), 'src.txt')
      fs.writeFileSync(src, `e2e-${e2eRunId()} archive source\n`)
      await kbfsMkdir(folder)
      await kbfsCopyIn(src, `${folder}/src.txt`)
      removeOutputFile(src)

      await openKbfsFolder(page, smokeFolder())
      await pickFromRowMenu(page, name, 'Backup folder')
      await expect(page.getByText('Save a copy of your content to your local drive', {exact: true}), 'the backup modal').toBeVisible({timeout: 10_000})
      await startToDestination(page, dest)
      await expect.poll(async () => (await ownKbfsJobs(dest)).length, {message: 'the folder backup job on the service', timeout: 15_000}).toBe(1)
      await page.getByText('See progress', {exact: true}).locator('visible=true').click()
      const [job] = await ownKbfsJobs(dest)
      await expect(kbfsJobRow(page, job?.desc.kbfsPathWithRevision.path ?? folder), 'the folder backup listed').toBeVisible({timeout: 15_000})
      await step(page, testInfo, 'folder backup listed', {card: true})
      await cancelOwnJobsInApp(page, testInfo, dest)
    },
    [async () => cancelOwnJobs(dest), async () => {
        removeOutputFile(dest)
        return Promise.resolve()
      }, async () => removeOwnKbfs(folder)]
  )
})

// "Backup all files" and "Backup all Git repos" from the Backup page, into a directory of their own.
// `countMatches`: the modal's "Started N jobs" must equal the jobs the service made.
const backupAll = async (page: Page, testInfo: TestInfo, button: string, sub: string, countMatches: boolean) => {
  const dest = path.join(runDir(), sub)
  fs.mkdirSync(dest)
  await withCleanup(
    async () => {
      await openArchivePage(page)
      await archivePage(page).getByText(button, {exact: true}).click()
      await startToDestination(page, dest)
      await expect(page.getByText(/^Started \d+ jobs successfully\.$/).locator('visible=true'), 'the started jobs count').toBeVisible({timeout: 60_000})
      const started = Number(/\d+/.exec(await page.getByText(/^Started \d+ jobs successfully\.$/).locator('visible=true').innerText())?.[0])
      expect(started, 'jobs started').toBeGreaterThan(0)
      // the service makes every job before it answers
      const made = (await ownKbfsJobs(dest)).length
      await step(page, testInfo, `${sub} backup started`, {card: true})
      await page.getByText('Close', {exact: true}).locator('visible=true').click()
      await cancelOwnJobsInApp(page, testInfo, dest)
      // checked after the jobs are cleared, so a wrong count still leaves nothing running
      if (countMatches) expect(made, `the jobs the service made, against the modal's "Started ${started} jobs successfully."`).toBe(started)
    },
    [
      async () => cancelOwnJobs(dest),
      async () => {
        // files one by one; a directory a backup left is afterAll's to remove with the run directory
        const entries = fs.readdirSync(dest, {withFileTypes: true})
        for (const f of entries) if (!f.isDirectory()) removeOutputFile(path.join(dest, f.name))
        if (entries.every(f => !f.isDirectory())) {
          requireInRunDir(dest)
          fs.rmdirSync(dest)
        }
        return Promise.resolve()
      },
    ]
  )
}

test('backup all files', async ({page}, testInfo) => {
  await backupAll(page, testInfo, 'Backup all files', 'all-files', true)
})

// The same backup, for the jobs the service made: they are listed and cancelled from the app.
test('backup all files makes jobs the page lists', async ({page}, testInfo) => {
  await backupAll(page, testInfo, 'Backup all files', 'all-files-jobs', false)
})

test('backup all git repos', async ({page}, testInfo) => {
  await backupAll(page, testInfo, 'Backup all Git repos', 'all-git', true)
})
