// Attachments sent from the app into e2e-scratch: every corpus file dropped on the thread, an image
// pasted into the composer, an upload cancelled while it runs, and an attachment deleted. Each is
// captioned with the run's stamp so the sweeper can find what a crashed run leaves.
import * as fs from 'fs'
import * as path from 'path'
import type {Locator, Page} from '@playwright/test'
import {test, expect, e2eMarker, e2eRunId, seedChatData} from '@/tests/e2e/electron/helpers/fixtures'
import {clickUnoccluded, composerInput, messageMenu, openE2EChannel, rowByOrdinal, waitForRow} from '@/tests/e2e/electron/helpers/chat'
import {dropFiles, pasteFiles} from '@/tests/e2e/electron/helpers/drop'
import {freshDownloadPath, removeOwnDownload} from '@/tests/e2e/electron/helpers/downloads'
import {reloadKeepingCoverage} from '@/tests/e2e/electron/helpers/persisted'
import {closeModal} from '@/tests/e2e/electron/helpers/modal'
import {recordMainWindowFullscreen} from '@/tests/e2e/electron/helpers/main-process'
import {step} from '@/tests/e2e/electron/helpers/step'
import {CORPUS, bigFile, type CorpusKind} from '@/tests/e2e/fixtures/corpus/corpus'
import {E2E_CHANNELS, readFromCli} from '@/tests/e2e/shared/chat-data'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  await seedChatData()
})

const thread = (page: Page) => page.getByTestId(T.CHAT_MESSAGE_LIST).locator('visible=true').first()
const caption = (page: Page) => page.getByPlaceholder('Add a caption...').locator('visible=true')
const visibleText = (page: Page, text: string) => page.getByText(text, {exact: true}).locator('visible=true')

// The attachment modal a drop or paste opens: captions it and sends it.
const sendFromModal = async (page: Page, title: string) => {
  await expect(caption(page), 'the attachment modal').toBeVisible({timeout: 15_000})
  await caption(page).fill(title)
  await clickUnoccluded(visibleText(page, 'Send').last())
  await expect(caption(page)).toHaveCount(0, {timeout: 10_000})
}

// The attachments titled `title` the CLI reads in e2e-scratch.
const attachmentsTitled = async (title: string) =>
  (await readFromCli({topicName: E2E_CHANNELS.scratch}, 30)).filter(
    m => m.content.type === 'attachment' && m.content.attachment?.object?.title === title
  )

const downloadKinds: ReadonlyArray<CorpusKind> = ['pdf', 'text', 'binary']

// How the desktop thread draws each corpus entry: Chromium cannot decode HEIC, so it is a file row,
// and an audio file is an audio player, which names no file (the CLI read-back checks its name).
type Rendering = 'image' | 'video' | 'audio' | 'file'
const renderingOf = (entry: (typeof CORPUS)[number]): Rendering =>
  entry.name.endsWith('.heic') ? 'file' : entry.kind === 'image' || entry.kind === 'video' || entry.kind === 'audio' ? entry.kind : 'file'

// The image opens in the app's attachment view, which its close button shuts.
const openImageFullscreen = async (page: Page, row: Locator) => {
  // the upload's progress bar covers the image until it is taken down
  await clickUnoccluded(row.getByTestId(T.CHAT_ATTACHMENT_IMAGE), 20_000)
  await expect(page.getByTestId(T.CHAT_ATTACHMENT_FULLSCREEN)).toBeVisible({timeout: 10_000})
  await closeModal(page)
  await expect(page.getByTestId(T.CHAT_ATTACHMENT_FULLSCREEN)).toHaveCount(0, {timeout: 5_000})
}

type FullscreenDoc = {fullscreenElement: {tagName: string} | null}
const fullscreenTag = async (page: Page) => page.evaluate(() => (document as unknown as FullscreenDoc).fullscreenElement?.tagName ?? null)

// Desktop plays a video inline and its fullscreen is the player's own. Driven input cannot leave
// that fullscreen (see chat-parity), so a reload closes it. The window's own transition into
// fullscreen ends about half a second after the video's fullscreenchange; a reload before it ends
// leaves the window in a state where the next video's fullscreen request is never answered. So the
// reload waits for the window to finish entering, and returns once it has left.
const openVideoFullscreen = async (page: Page, row: Locator) => {
  await clickUnoccluded(row.getByText(/^\d+:\d{2}\b/).locator('xpath=../..'))
  const video = row.locator('video')
  await expect(video).toHaveCount(1, {timeout: 10_000})
  await expect
    .poll(async () => video.evaluate(el => (el as unknown as {currentTime: number}).currentTime), {timeout: 10_000})
    .toBeGreaterThan(0)
  const box = await video.boundingBox({timeout: 5_000})
  if (!box) throw new Error('the video has no box')
  const win = await recordMainWindowFullscreen()
  try {
    await page.mouse.dblclick(box.x + box.width * 0.6, box.y + box.height * 0.3)
    await expect.poll(async () => fullscreenTag(page), {timeout: 5_000}).toBe('VIDEO')
    await expect
      .poll(async () => win.transitions(), {message: 'the window entering fullscreen', timeout: 5_000})
      .toEqual(['enter-full-screen'])
    await reloadKeepingCoverage(page)
    expect(await fullscreenTag(page)).toBeNull()
    await expect
      .poll(async () => win.transitions(), {message: 'the window leaving fullscreen', timeout: 5_000})
      .toEqual(['enter-full-screen', 'leave-full-screen'])
  } finally {
    await win.stop()
  }
}

test.describe('drop', () => {
  for (const entry of CORPUS) {
    test(`drop ${entry.name} sends it`, async ({page}, testInfo) => {
      test.setTimeout(120_000)
      await openE2EChannel(page)
      const title = e2eMarker('drop')
      await dropFiles(page, thread(page), [entry.file])
      await expect(visibleText(page, `${entry.name} (1 of 1)`), 'the modal names the dropped file').toBeVisible({timeout: 15_000})
      await sendFromModal(page, title)

      const ordinal = await waitForRow(page, title, 60_000)
      const row = rowByOrdinal(page, ordinal)
      const rendering = renderingOf(entry)
      if (rendering === 'audio') {
        await expect(row.getByTestId(T.CHAT_AUDIO_PLAYER), 'the row plays the audio').toHaveCount(1, {timeout: 30_000})
      } else {
        await expect(row.getByText(entry.name, {exact: true}), 'the row names the file').toHaveCount(1, {timeout: 30_000})
      }
      await expect(row.locator('.sendingStatus')).toHaveCount(0, {timeout: 60_000})
      await step(page, testInfo, `${entry.name} sent`)
      await expect
        .poll(async () => (await attachmentsTitled(title)).map(m => path.basename(m.content.attachment?.object?.filename ?? '')), {
          message: 'the file name the CLI reads for the attachment',
          timeout: 30_000,
        })
        .toEqual([entry.name])

      if (rendering === 'image') await openImageFullscreen(page, row)
      if (rendering === 'video') await openVideoFullscreen(page, row)
      if (downloadKinds.includes(entry.kind)) {
        const target = freshDownloadPath(entry.name)
        const size = fs.statSync(entry.file).size
        let failure: Error | undefined
        try {
          const menu = await messageMenu(page, ordinal)
          await clickUnoccluded(menu.getByText('Download', {exact: true}))
          await expect
            .poll(() => fs.statSync(target, {throwIfNoEntry: false})?.size, {message: `${target} after Download`, timeout: 30_000})
            .toBe(size)
          await expect(row.getByText(/^Show in /), 'the row offers to show the download').toBeVisible({timeout: 10_000})
        } catch (e) {
          failure = e instanceof Error ? e : new Error(String(e))
        }
        // a failed delete keeps the download's own failure, if there was one
        try {
          if (fs.existsSync(target)) removeOwnDownload(target, size)
        } catch (e) {
          if (failure === undefined) throw e
          throw new AggregateError([failure, e], `${failure.message}; and then deleting the download failed: ${String(e)}`, {cause: e})
        }
        if (failure !== undefined) throw failure
      }
    })
  }
})

test('paste an image sends it', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const png = CORPUS.find(e => e.name === 'e2e-c.png')
  if (!png) throw new Error('the corpus has no e2e-c.png')
  await openE2EChannel(page)

  // a pasted image is held as an upload file until the modal sends it; Cancel drops that file
  await pasteFiles(page, composerInput(page), [png.file])
  await expect(caption(page), 'the attachment modal after a paste').toBeVisible({timeout: 15_000})
  await clickUnoccluded(visibleText(page, 'Cancel').last())
  await expect(caption(page)).toHaveCount(0, {timeout: 10_000})

  await pasteFiles(page, composerInput(page), [png.file])
  const title = e2eMarker('paste')
  await sendFromModal(page, title)
  const row = rowByOrdinal(page, await waitForRow(page, title, 60_000))
  await expect(row.getByTestId(T.CHAT_ATTACHMENT_IMAGE)).toHaveCount(1, {timeout: 30_000})
  await step(page, testInfo, 'pasted image sent')
  await expect.poll(async () => (await attachmentsTitled(title)).length, {message: 'the CLI reads the pasted image', timeout: 30_000}).toBe(1)
})

// The CLI read of a whole bigFile upload (uploaded: true) was measured landing within about 3s of
// its row showing "Uploading"; the read-back watches several times that long for it to appear.
const uploadWatchMs = 20_000

test('delete an upload in flight', async ({page}, testInfo) => {
  test.setTimeout(180_000)
  const file = await bigFile(e2eRunId())
  await openE2EChannel(page)
  const title = e2eMarker('upcancel')
  await dropFiles(page, thread(page), [file])
  await sendFromModal(page, title)

  const ordinal = await waitForRow(page, title, 60_000)
  const row = rowByOrdinal(page, ordinal)
  await expect(row.getByText('Uploading', {exact: true}), 'the upload in progress').toBeVisible({timeout: 30_000})
  await step(page, testInfo, 'uploading')
  // the row's Delete is how an upload in flight is stopped
  const menu = await messageMenu(page, ordinal)
  await clickUnoccluded(menu.getByText('Delete', {exact: true}))

  await expect
    .poll(async () => attachmentsTitled(title), {message: 'attachments with the deleted title, from the CLI', timeout: 30_000})
    .toEqual([])
  // and nothing lands after: an upload the delete missed would post once it finished
  for (const until = Date.now() + uploadWatchMs; Date.now() < until; await page.waitForTimeout(1_000)) {
    expect(await attachmentsTitled(title), 'attachments with the deleted title, from the CLI').toEqual([])
  }
  await expect(thread(page).locator('[data-ordinal]').filter({hasText: title}), 'no attachment row').toHaveCount(0, {timeout: 10_000})
  await step(page, testInfo, 'upload deleted')
})

test('delete an attachment', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const txt = CORPUS.find(e => e.name === 'e2e-c.txt')
  if (!txt) throw new Error('the corpus has no e2e-c.txt')
  await openE2EChannel(page)
  const title = e2eMarker('attdel')
  await dropFiles(page, thread(page), [txt.file])
  await sendFromModal(page, title)
  const ordinal = await waitForRow(page, title, 60_000)
  await expect(rowByOrdinal(page, ordinal).locator('.sendingStatus')).toHaveCount(0, {timeout: 60_000})

  const menu = await messageMenu(page, ordinal)
  await clickUnoccluded(menu.getByText('Delete', {exact: true}))
  await expect(rowByOrdinal(page, ordinal)).toHaveCount(0, {timeout: 20_000})
  await step(page, testInfo, 'attachment deleted')
  await expect.poll(async () => (await attachmentsTitled(title)).length, {message: 'attachments with the deleted title, from the CLI', timeout: 20_000}).toBe(0)
})
