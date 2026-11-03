// Uploads into and downloads from a folder each test makes (e2e-<runid>-files-<hex> in the smoke
// account's private folder): the Upload button through a stubbed picker, a drop of every corpus
// file, a download saved to ~/Downloads and one cancelled, and the preview of each kind the app shows.
import * as fs from 'fs'
import type {Page} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {dropFiles} from '@/tests/e2e/electron/helpers/drop'
import {freshDownloadPath, removeOwnDownload} from '@/tests/e2e/electron/helpers/downloads'
import {
  clickFresh,
  expectUploadedRow,
  filesRow,
  kbfsCopyIn,
  kbfsList,
  newWorkFolder,
  openKbfsFolder,
  pickFromRowMenu,
  removeOwnKbfs,
  stampedEntry,
  workFolderWith,
} from '@/tests/e2e/electron/helpers/files'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {step} from '@/tests/e2e/electron/helpers/step'
import {CORPUS, bigFile} from '@/tests/e2e/fixtures/corpus/corpus'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

const corpusFile = (name: string) => {
  const entry = CORPUS.find(e => e.name === name)
  if (!entry) throw new Error(`the corpus has no ${name}`)
  return entry.file
}

// -- uploads --------------------------------------------------------------------------------------

type UploadState = {uploadID: string; targetPath: {path: string}; error?: string | null}
const uploads = async () => (await mainRpc<Array<UploadState> | null>('keybase.1.SimpleFS.simpleFSGetUploadStatus', {})) ?? []
const uploadsTo = async (kbfsPath: string) => (await uploads()).filter(u => `/keybase${u.targetPath.path}` === kbfsPath)

// The service keeps a failed upload until it is dismissed: one into the test's folder is its own.
const dismissFailedUploadsIn = async (folder: string) => {
  for (const u of await uploads()) {
    if (u.error && `/keybase${u.targetPath.path}`.startsWith(`${folder}/`)) {
      await mainRpc('keybase.1.SimpleFS.simpleFSDismissUpload', {uploadID: u.uploadID})
    }
  }
}

const removeUnreadableFolder = (dir: string) => {
  if (!fs.existsSync(dir)) return
  if (fs.existsSync(`${dir}/b.txt`)) fs.chmodSync(`${dir}/b.txt`, 0o600)
  fs.rmSync(dir, {recursive: true})
}

// A local folder whose second file cannot be read, so uploading it fails after the folder is made
// in KBFS: a failed upload is the one the app offers to dismiss (a finished one clears itself).
const unreadableFolder = () => {
  const dir = `/tmp/kb-e2e/${stampedEntry('updir')}`
  removeUnreadableFolder(dir)
  fs.mkdirSync(dir, {recursive: true})
  fs.writeFileSync(`${dir}/a.txt`, 'a')
  fs.writeFileSync(`${dir}/b.txt`, 'b')
  fs.chmodSync(`${dir}/b.txt`, 0o000)
  return dir
}

// The header's Upload (an empty folder shows a second one in its middle).
const uploadButton = (page: Page) => page.getByText('Upload', {exact: true}).locator('visible=true').first()

test('upload with the button', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const pdf = corpusFile('e2e-c.pdf')
  const local = unreadableFolder()
  const folder = newWorkFolder()
  const failedTarget = `${folder}/${stampedEntry('updir')}`
  await withCleanup(
    async () => {
      await workFolderWith(page, folder)
      const main = await connectMainProcess()
      // the picker opens only over the focused window, which a driven window is not
      await main.stubFocusedWindow()
      await main.stubOpenDialog([pdf])
      await uploadButton(page).click()
      await expectUploadedRow(page, folder, 'e2e-c.pdf', fs.statSync(pdf).size)
      await step(page, testInfo, 'uploaded', {card: true})

      await main.stubOpenDialog([local])
      await uploadButton(page).click()
      const failed = filesRow(page, stampedEntry('updir')).getByText('Upload has failed.', {exact: false})
      await expect(failed, 'the failed upload').toHaveCount(1, {timeout: 30_000})
      await expect.poll(async () => (await uploadsTo(failedTarget)).length, {message: 'the failed upload from the service'}).toBe(1)
      await step(page, testInfo, 'upload failed')
      await failed.getByText('Dismiss', {exact: true}).click()
      await expect.poll(async () => (await uploadsTo(failedTarget)).length, {message: 'the dismissed upload from the service'}).toBe(0)
      await expect(failed, 'the dismissed failure').toHaveCount(0)
      await step(page, testInfo, 'failure dismissed')
    },
    [
      async () => dismissFailedUploadsIn(folder),
      async () => removeOwnKbfs(folder),
      async () => Promise.resolve().then(() => removeUnreadableFolder(local)),
    ]
  )
})

// One file per drop: the app copies a drop's files into one temporary folder that the service
// deletes when the first of them finishes uploading, so the rest of a multi-file drop fail.
test('upload by drop', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await workFolderWith(page, folder)
      const browser = page.getByTestId(T.FILES_BROWSER).locator('visible=true')
      for (const e of CORPUS) {
        await dropFiles(page, browser, [e.file])
        await expectUploadedRow(page, folder, e.name, fs.statSync(e.file).size)
      }
      await step(page, testInfo, 'dropped', {card: true})
      const want = CORPUS.map(e => ({name: e.name, size: fs.statSync(e.file).size})).sort((a, b) => a.name.localeCompare(b.name))
      expect(want.some(e => e.size === 0), 'the corpus has an empty file').toBe(true)
      await expect
        .poll(
          async () =>
            (await kbfsList(folder)).map(e => ({name: e.name, size: e.size})).sort((a, b) => a.name.localeCompare(b.name)),
          {message: 'the uploaded names and sizes from the CLI', timeout: 60_000}
        )
        .toEqual(want)
    },
    [async () => dismissFailedUploadsIn(folder), async () => removeOwnKbfs(folder)]
  )
})

// -- downloads ------------------------------------------------------------------------------------

type DownloadStatus = {regularDownloadIDs: Array<string> | null; states: Array<{downloadID: string; canceled: boolean; done: boolean}> | null}
const downloadStatus = async () => mainRpc<DownloadStatus>('keybase.1.SimpleFS.simpleFSGetDownloadStatus', {})
const downloadIDs = async () => (await downloadStatus()).regularDownloadIDs ?? []
const downloadCard = (page: Page, name: string) => page.getByTestId(T.FILES_DOWNLOAD).locator('visible=true').filter({hasText: name})

// Dismisses, through the service, the downloads started since `before` that are still listed.
const dismissDownloadsSince = async (before: ReadonlyArray<string>) => {
  for (const id of await downloadIDs()) {
    if (!before.includes(id)) await mainRpc('keybase.1.SimpleFS.simpleFSDismissDownload', {downloadID: id})
  }
}

test('download and dismiss', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const name = stampedEntry('dl.txt')
  const local = corpusFile('e2e-c.txt')
  const size = fs.statSync(local).size
  const target = freshDownloadPath(name)
  const before = await downloadIDs()
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await workFolderWith(page, folder, {[name]: local})
      await pickFromRowMenu(page, name, 'Download')
      await expect.poll(() => fs.statSync(target, {throwIfNoEntry: false})?.size, {message: `${target} after Download`, timeout: 30_000}).toBe(size)
      const card = downloadCard(page, name)
      await expect(card.locator('.icon-gen-iconfont-success'), 'the finished download').toHaveCount(1, {timeout: 15_000})
      await step(page, testInfo, 'downloaded', {card: true})
      const id = (await downloadIDs()).find(i => !before.includes(i))
      if (!id) throw new Error('the service lists no new download')
      await card.locator('.icon-gen-iconfont-remove').click()
      await expect.poll(downloadIDs, {message: 'the downloads the service lists'}).not.toContain(id)
      await expect(card, 'the dismissed card').toHaveCount(0)
      await step(page, testInfo, 'dismissed')
    },
    [
      async () => dismissDownloadsSince(before),
      async () => Promise.resolve().then(() => fs.existsSync(target) && removeOwnDownload(target, size)),
      async () => removeOwnKbfs(folder),
    ]
  )
})

type CancelGlobals = {
  __kbE2ECancelled?: boolean
  __kbE2ECancelWatch?: {disconnect: () => void}
  MutationObserver: new (f: () => void) => {observe: (n: unknown, o: object) => void; disconnect: () => void}
  document: {body: unknown; querySelectorAll: (s: string) => ArrayLike<{textContent: string | null; querySelector: (s: string) => {click: () => void} | null}>}
}

// Presses the download card's cancel the moment it shows the download running. The file comes from
// the local KBFS cache in well under a second, faster than a driven click lands, so the press is
// made in the page as the card renders.
const cancelWhenRunning = async (page: Page, name: string) =>
  page.evaluate(
    ([testID, progressID, n]) => {
      const g = globalThis as unknown as CancelGlobals
      g.__kbE2ECancelled = false
      const watch = new g.MutationObserver(() => {
        for (const card of Array.from(g.document.querySelectorAll(`[data-testid="${testID}"]`))) {
          // a running download's card shows its progress, and its remove button cancels
          const cancel = card.textContent?.includes(n) && card.querySelector(`[data-testid="${progressID}"]`) && card.querySelector('.icon-gen-iconfont-remove')
          if (!cancel) continue
          watch.disconnect()
          g.__kbE2ECancelled = true
          cancel.click()
          return
        }
      })
      watch.observe(g.document.body, {childList: true, subtree: true})
      g.__kbE2ECancelWatch = watch
    },
    [T.FILES_DOWNLOAD, T.FILES_DOWNLOAD_PROGRESS, name] as const
  )

test('cancel a download', async ({page}, testInfo) => {
  test.setTimeout(240_000)
  const name = stampedEntry('big.bin')
  const target = freshDownloadPath(name)
  const before = await downloadIDs()
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await workFolderWith(page, folder)
      await kbfsCopyIn(await bigFile(e2eRunId()), `${folder}/${name}`)
      await openKbfsFolder(page, folder)
      await expect(filesRow(page, name)).toHaveCount(1, {timeout: 20_000})
      await cancelWhenRunning(page, name)
      await pickFromRowMenu(page, name, 'Download')
      await expect.poll(async () => page.evaluate(() => (globalThis as unknown as CancelGlobals).__kbE2ECancelled), {message: 'cancel pressed'}).toBe(true)
      await expect
        .poll(async () => (await downloadStatus()).states?.filter(s => !before.includes(s.downloadID)).map(s => ({canceled: s.canceled, done: s.done})), {
          message: 'the download from the service',
          timeout: 20_000,
        })
        .toEqual([{canceled: true, done: false}])
      expect(fs.existsSync(target), `${target} after the cancel`).toBe(false)
      await step(page, testInfo, 'cancelled', {card: true})
      await clickFresh(downloadCard(page, name).locator('.icon-gen-iconfont-remove'), 'the cancelled card')
      await expect(downloadCard(page, name), 'the dismissed card').toHaveCount(0, {timeout: 10_000})
    },
    [
      async () => page.evaluate(() => (globalThis as unknown as CancelGlobals).__kbE2ECancelWatch?.disconnect()),
      async () => dismissDownloadsSince(before),
      async () => {
        if (fs.existsSync(target)) removeOwnDownload(target, fs.statSync(await bigFile(e2eRunId())).size)
      },
      async () => removeOwnKbfs(folder),
    ]
  )
})

// -- previews -------------------------------------------------------------------------------------

// What each kind's preview draws, and that it loaded: a picture with pixels, a video player with its
// metadata, a PDF viewer whose file the service serves, the text itself (its testID appears only
// once the text is in). An element alone is not enough: the service answers a missing file with a 404
// that the element still renders around.
type Loaded = {complete?: boolean; naturalWidth?: number; readyState?: number; error?: unknown; src?: string}
const previews: ReadonlyArray<{name: string; shows: (page: Page) => ReturnType<Page['locator']>; loaded: (el: ReturnType<Page['locator']>) => Promise<boolean>}> = [
  {
    loaded: async el => el.evaluate(e => !!(e as unknown as Loaded).complete && ((e as unknown as Loaded).naturalWidth ?? 0) > 0),
    name: 'e2e-c.png',
    shows: page => page.locator('img[src*="/files/"]').locator('visible=true'),
  },
  {
    loaded: async el => el.evaluate(e => ((e as unknown as Loaded).readyState ?? 0) >= 1 && !(e as unknown as Loaded).error),
    name: 'e2e-c.mp4',
    shows: page => page.locator('video').locator('visible=true'),
  },
  {
    loaded: async el => el.evaluate(async e => (await fetch((e as unknown as Loaded).src ?? '')).status === 200),
    name: 'e2e-c.pdf',
    shows: page => page.locator('embed[src*="/files/"]').locator('visible=true'),
  },
  {loaded: async () => Promise.resolve(true), name: 'e2e-c.txt', shows: page => page.getByTestId(T.FILES_TEXT_PREVIEW).locator('visible=true')},
]

test('previews per corpus type', async ({page}, testInfo) => {
  test.setTimeout(180_000)
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await workFolderWith(page, folder, Object.fromEntries(previews.map(p => [p.name, corpusFile(p.name)])))
      for (const p of previews) {
        await openKbfsFolder(page, folder)
        await clickFresh(filesRow(page, p.name), `the row ${p.name}`)
        await expect(p.shows(page), `the preview of ${p.name}`).toHaveCount(1, {timeout: 20_000})
        await expect.poll(async () => p.loaded(p.shows(page)), {message: `the preview of ${p.name} loaded`, timeout: 20_000}).toBe(true)
        await step(page, testInfo, `preview ${p.name}`, {card: p.name.endsWith('.png')})
      }
    },
    [async () => removeOwnKbfs(folder)]
  )
})
