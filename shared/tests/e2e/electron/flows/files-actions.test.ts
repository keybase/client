// Folder and file actions in the Files tab, each on entries this run makes in the smoke account's
// private folder (e2e-<runid>-files-<hex>, made through the app's New folder) or the smoke+second folder,
// with a CLI or RPC read-back of what the app did. Settings a test changes (the sync mode of the
// smoke+second folder, its favorite state, the Finder banner) are read first and put back after.
import type {Page} from '@playwright/test'
import {test, expect, e2eMarker} from '@/tests/e2e/electron/helpers/fixtures'
import {clickUnoccluded, openSelfConversation, rowByOrdinal, waitForRow} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {
  clickFresh,
  closeSecondTrackerPopups,
  filesRow,
  kbfsList,
  kbfsMkdir,
  leaf,
  makeFolderInApp,
  openKbfsFolder,
  pairFavoriteState,
  pairFolder,
  pickFromRowMenu,
  refavoritePair,
  removeOwnKbfs,
  stampedEntry,
  newWorkFolder,
  workFolderWith,
} from '@/tests/e2e/electron/helpers/files'
import {navigateToFiles} from '@/tests/e2e/electron/helpers/navigate'
import {expectPersists, reloadKeepingCoverage} from '@/tests/e2e/electron/helpers/persisted'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import {CORPUS} from '@/tests/e2e/fixtures/corpus/corpus'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {readFromCli} from '@/tests/e2e/shared/chat-data'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

const corpusFile = (name: string) => {
  const entry = CORPUS.find(e => e.name === name)
  if (!entry) throw new Error(`the corpus has no ${name}`)
  return entry.file
}
const txt = corpusFile('e2e-c.txt')

const names = async (dir: string) => (await kbfsList(dir)).map(e => e.name).sort()

test('make a folder', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await makeFolderInApp(page, folder)
      await step(page, testInfo, 'folder made', {card: true})
    },
    [async () => removeOwnKbfs(folder)]
  )
})

test('rename', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const from = stampedEntry('a.txt')
  const to = stampedEntry('b.txt')
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await workFolderWith(page, folder, {[from]: txt})
      await pickFromRowMenu(page, from, 'Rename')
      const input = page.getByTestId(T.FILES_EDITING_ROW).locator('input')
      await input.fill(to)
      await input.press('Enter')
      await expect(filesRow(page, to), 'the renamed row').toHaveCount(1, {timeout: 20_000})
      await expect(filesRow(page, from), 'the old name').toHaveCount(0)
      await step(page, testInfo, 'renamed', {card: true})
      await expect.poll(async () => names(folder), {message: `${folder} from the CLI`, timeout: 30_000}).toEqual([to])
    },
    [async () => removeOwnKbfs(folder)]
  )
})

// Moves or copies a file into a folder beside it with the destination picker.
const moveOrCopy = async (page: Page, folder: string, action: 'Move here' | 'Copy here') => {
  const file = stampedEntry('mc.txt')
  const dest = stampedEntry('dest')
  await workFolderWith(page, folder, {[file]: txt}, [dest])
  await pickFromRowMenu(page, file, 'Move or Copy')
  const picker = page.getByTestId(T.FILES_DESTINATION_PICKER).locator('visible=true')
  await expect(picker).toHaveCount(1, {timeout: 10_000})
  await clickFresh(picker.getByTestId(T.FILES_ROW).filter({has: page.getByText(dest, {exact: true})}), `the picker's ${dest} row`)
  await expect(picker.getByText(dest, {exact: true}).first(), 'the picker in the destination').toBeVisible({timeout: 10_000})
  await picker.getByText(action, {exact: true}).click()
  await expect(picker).toHaveCount(0, {timeout: 10_000})
  return {dest, file}
}

test('move with the picker', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      const {dest, file} = await moveOrCopy(page, folder, 'Move here')
      await expect.poll(async () => names(`${folder}/${dest}`), {message: 'the destination from the CLI', timeout: 30_000}).toEqual([file])
      await expect.poll(async () => names(folder), {message: 'the source folder from the CLI', timeout: 30_000}).toEqual([dest])
      await step(page, testInfo, 'moved', {card: true})
    },
    [async () => removeOwnKbfs(folder)]
  )
})

test('copy with the picker', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      const {dest, file} = await moveOrCopy(page, folder, 'Copy here')
      await expect.poll(async () => names(`${folder}/${dest}`), {message: 'the destination from the CLI', timeout: 30_000}).toEqual([file])
      await expect.poll(async () => names(folder), {message: 'the source folder from the CLI', timeout: 30_000}).toEqual([dest, file].sort())
      await step(page, testInfo, 'copied', {card: true})
    },
    [async () => removeOwnKbfs(folder)]
  )
})

test('delete', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const file = stampedEntry('del.txt')
  const keep = stampedEntry('keep.txt')
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await workFolderWith(page, folder, {[file]: txt, [keep]: txt})
      await pickFromRowMenu(page, file, 'Delete')
      await page.getByText('Yes, delete', {exact: true}).locator('visible=true').click()
      await expect(filesRow(page, file), 'the deleted row').toHaveCount(0, {timeout: 20_000})
      await expect(filesRow(page, keep), 'the other row').toHaveCount(1)
      await step(page, testInfo, 'deleted', {card: true})
      await expect.poll(async () => names(folder), {message: `${folder} from the CLI`, timeout: 30_000}).toEqual([keep])
    },
    [async () => removeOwnKbfs(folder)]
  )
})

// -- the smoke+second folder ----------------------------------------------------------------------

const pairName = () => leaf(pairFolder())

test('ignore a folder', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  expect(await pairFavoriteState(), 'the smoke+second folder before the test').toEqual({favorite: true, ignored: false})
  let ignored = false
  await withCleanup(
    async () => {
      await openKbfsFolder(page, '/keybase/private')
      await expect(filesRow(page, pairName()), 'the smoke+second row').toHaveCount(1, {timeout: 20_000})
      ignored = true
      await pickFromRowMenu(page, pairName(), 'Ignore this folder')
      await expect.poll(pairFavoriteState, {message: 'the folder from the service', timeout: 20_000}).toEqual({favorite: false, ignored: true})
      await expect(filesRow(page, pairName()), 'the ignored row').toHaveCount(0, {timeout: 20_000})
      await step(page, testInfo, 'ignored', {card: true})
    },
    [
      async () => {
        if (!ignored) return
        await refavoritePair()
        await reloadKeepingCoverage(page)
        await openKbfsFolder(page, '/keybase/private')
        await expect(filesRow(page, pairName()), 'the smoke+second row after favoriteAdd').toHaveCount(1, {timeout: 20_000})
      },
      async () => closeSecondTrackerPopups(page),
    ]
  )
})

// The toggle is offered only on a top-level folder, and the smoke+second folder is the smallest
// one the flows write to: syncing it downloads just the entry the test puts there.
type SyncConfig = {mode: number; paths: Array<string> | null}
const syncDisabled = 0
const syncEnabled = 1
const pairRpcPath = () => ({PathType: 1, kbfs: {identifyBehavior: null, path: pairFolder().slice('/keybase'.length)}})
const pairSyncConfig = async () =>
  (await mainRpc<{config: SyncConfig}>('keybase.1.SimpleFS.simpleFSFolderSyncConfigAndStatus', {path: pairRpcPath()})).config

// The "Sync on this device" switch on the screen shown, and whether it is on (its knob sits right).
const syncSwitch = (page: Page) =>
  page
    .getByText('Sync on this device', {exact: true})
    .locator('visible=true')
    .locator('xpath=ancestor::*[.//div[contains(@style, "width: 24px")]][1]//div[contains(@style, "width: 24px")]')
const syncSwitchOn = async (page: Page) =>
  syncSwitch(page).evaluate(el => (el as unknown as {style: Record<string, string>}).style['paddingLeft'] === '10px')

test('sync a folder', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const original = await pairSyncConfig()
  expect(original.mode, 'the smoke+second folder must start unsynced (the toggle would ask to unsync it)').toBe(syncDisabled)
  const entry = `${pairFolder()}/${stampedEntry('sync')}`
  await withCleanup(
    async () => {
      // the toggle is hidden on an empty folder that is not synced
      await kbfsMkdir(entry)
      await openKbfsFolder(page, pairFolder())
      await expect.poll(async () => syncSwitchOn(page), {message: 'the switch before', timeout: 10_000}).toBe(false)
      await syncSwitch(page).click()
      await expect.poll(async () => (await pairSyncConfig()).mode, {message: 'the sync mode from the service', timeout: 20_000}).toBe(syncEnabled)
      await step(page, testInfo, 'synced', {card: true})
      await expectPersists(
        page,
        async () => {
          await openKbfsFolder(page, pairFolder())
          await expect.poll(async () => syncSwitchOn(page), {message: 'the switch after a reload', timeout: 15_000}).toBe(true)
          return true
        },
        true,
        'the sync switch'
      )
    },
    [
      async () => {
        await mainRpc('keybase.1.SimpleFS.simpleFSSetFolderSyncConfig', {config: original, path: pairRpcPath()})
        expect(await pairSyncConfig(), 'the sync config after the restore').toEqual(original)
      },
      async () => removeOwnKbfs(entry),
      async () => closeSecondTrackerPopups(page),
    ]
  )
})

// -- the Finder banner -------------------------------------------------------------------------------

const bannerDismissed = async () =>
  (await mainRpc<{sfmiBannerDismissed: boolean}>('keybase.1.SimpleFS.simpleFSSettings', {})).sfmiBannerDismissed
const setBannerDismissed = async (dismissed: boolean) => {
  await mainRpc('keybase.1.SimpleFS.simpleFSSetSfmiBannerDismissed', {dismissed})
  expect(await bannerDismissed(), 'the banner setting after setting it').toBe(dismissed)
}

const filesRoot = async (page: Page) => {
  await navigateToFiles(page)
  await page.getByTestId(T.NAV_TAB_FILES).click()
  await expect(page.getByTestId(T.FILES_TLF_ROW).locator('visible=true')).toHaveCount(3, {timeout: 10_000})
}

test('Finder banner dismiss', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const original = await bannerDismissed()
  await withCleanup(
    async () => {
      if (original) {
        await setBannerDismissed(false)
        await reloadKeepingCoverage(page)
      }
      await filesRoot(page)
      const banner = page.getByTestId(T.FILES_SFMI_BANNER).locator('visible=true')
      await expect(banner, 'the Finder banner').toHaveCount(1, {timeout: 15_000})
      await step(page, testInfo, 'banner shown')
      await banner.locator('.icon-gen-iconfont-close').click()
      await expect.poll(bannerDismissed, {message: 'the banner setting from the service', timeout: 10_000}).toBe(true)
      await expect(banner, 'the dismissed banner').toHaveCount(0)
      await step(page, testInfo, 'banner dismissed', {card: true})
      await expectPersists(
        page,
        async () => {
          await filesRoot(page)
          // Until the app has read the setting it shows the Finder icons (in the header and on each
          // row), and with the banner not dismissed it keeps them: their going proves the read.
          await expect(page.locator('.icon-gen-iconfont-finder').locator('visible=true'), 'the Finder icons').toHaveCount(0, {
            timeout: 15_000,
          })
          return page.getByTestId(T.FILES_SFMI_BANNER).locator('visible=true').count()
        },
        0,
        'the Finder banner'
      )
    },
    [async () => setBannerDismissed(original)]
  )
})

// -- sharing and the OS --------------------------------------------------------------------------

test('share to chat', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const {smokeUser} = loadE2EAccounts()
  const file = stampedEntry('share.txt')
  const title = e2eMarker('fshare')
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await workFolderWith(page, folder, {[file]: txt})
      await pickFromRowMenu(page, file, 'Share to Chat')
      const search = page.getByPlaceholder('Search chats...').locator('visible=true')
      await search.fill(smokeUser)
      // the self conversation's result is the one named only by the user
      const result = page.getByTestId(T.CHAT_SEND_TO_CHAT_ROW).locator('visible=true').filter({has: page.getByText(smokeUser, {exact: true})})
      await expect(result, 'the self conversation result').toHaveCount(1, {timeout: 15_000})
      await clickFresh(result, 'the self conversation result')
      const caption = page.getByPlaceholder('Add a caption...').locator('visible=true')
      await expect(caption, 'the attachment titles modal').toBeVisible({timeout: 15_000})
      await caption.fill(title)
      await clickUnoccluded(page.getByText('Send', {exact: true}).locator('visible=true').last())
      await expect(caption).toHaveCount(0, {timeout: 10_000})
      await openSelfConversation(page, smokeUser)
      const row = rowByOrdinal(page, await waitForRow(page, title, 60_000))
      await expect(row.getByText(file, {exact: true}), 'the attachment row names the file').toHaveCount(1, {timeout: 30_000})
      await step(page, testInfo, 'shared', {card: true})
      await expect
        .poll(
          async () =>
            (await readFromCli({tlfName: smokeUser}, 30))
              .filter(m => m.content.type === 'attachment' && m.content.attachment?.object?.title === title)
              .map(m => leaf(m.content.attachment?.object?.filename ?? '')),
          {message: 'the attachment from the CLI', timeout: 30_000}
        )
        .toEqual([file])
    },
    [async () => removeOwnKbfs(folder)]
  )
})

test('open in Finder', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const file = stampedEntry('finder.txt')
  const folder = newWorkFolder()
  await withCleanup(
    async () => {
      await workFolderWith(page, folder, {[file]: txt})
      const row = filesRow(page, file)
      await row.hover()
      // with Keybase not enabled in Finder this offers to enable it; a person checks Show in Finder
      await expect(row.locator('.icon-gen-iconfont-finder'), "the row's Finder icon").toBeVisible()
      await manualEdge(page, testInfo, 'os-open-in-finder')
    },
    [async () => removeOwnKbfs(folder)]
  )
})
