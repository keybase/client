// The Files tab: opening folders, rows and their menus. The KBFS entries the files flows make, and
// the guard on every write to them, are shared/files.ts's.
import {expect, type Locator, type Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {kbfsCopyIn, kbfsEntry, kbfsMkdir, leaf} from '@/tests/e2e/shared/files'
import * as T from '@/tests/e2e/shared/test-ids'
import {openMenu} from './menu'
import {retriedNavigation} from './step'

export {pairFavoriteState, pairFolder, refavoritePair} from '@/tests/e2e/shared/favorites'
export {
  kbfsCopyIn,
  kbfsEntry,
  kbfsList,
  kbfsMkdir,
  leaf,
  newWorkFolder,
  removeOwnKbfs,
  smokeFolder,
  stampedEntry,
  type KbfsEntry,
} from '@/tests/e2e/shared/files'

// Runs `act` on `target`, retrying while the list under it re-renders (a resorted or re-pushed list
// replaces the row the first attempt found).
const onFresh = async (target: Locator, what: string, act: (t: Locator) => Promise<void>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      await act(target)
      return
    } catch (e) {
      if (attempt === 8) throw new Error(`${what}: not reached in 8 tries: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
    }
  }
}

export const clickFresh = async (target: Locator, what: string) => onFresh(target, what, async t => t.click({timeout: 2_000}))

// The listing row named exactly `name` on the screen shown. A name is drawn as its stem and its
// extension side by side, so the match is on their container.
export const filesRow = (page: Page, name: string) =>
  page
    .getByTestId(T.FILES_ROW)
    .locator('visible=true')
    .filter({has: page.getByText(name, {exact: true})})

// Opens `folder` (/keybase/private or a path under it) by clicking down to it from the Files root.
export const openKbfsFolder = async (page: Page, folder: string) => {
  const parts = folder.split('/').filter(Boolean)
  if (parts[0] !== 'keybase' || parts[1] !== 'private') throw new Error(`not a private folder path: ${folder}`)
  const tlfTypes = page.getByTestId(T.FILES_TLF_ROW).locator('visible=true')
  // the Files tab pops to its root when it is clicked while shown
  await retriedNavigation('the Files root', async () => {
    if ((await tlfTypes.count()) !== 3) await page.getByTestId(T.NAV_TAB_FILES).click()
    await expect(tlfTypes, 'the Files root').toHaveCount(3, {timeout: 2_000})
  }, {intervals: [0], timeout: 10_000})
  await clickFresh(tlfTypes.filter({hasText: 'private'}), 'the private folder row')
  for (const name of parts.slice(2)) {
    await expect(filesRow(page, name), `the row ${name}`).toHaveCount(1, {timeout: 20_000})
    await clickFresh(filesRow(page, name), `the row ${name}`)
  }
  await expect(page.getByText(parts.at(-1) ?? '', {exact: true}).locator('visible=true').first(), 'the folder title').toBeVisible({timeout: 10_000})
}

// Picks `item` from the row's own menu.
export const pickFromRowMenu = async (page: Page, name: string, item: string) => {
  const row = filesRow(page, name)
  await onFresh(row, `the row ${name}`, async t => t.hover({timeout: 2_000}))
  const entry = page.getByText(item, {exact: true}).locator('visible=true')
  await openMenu(page, row.locator('.icon-gen-iconfont-ellipsis'), entry, `${name}'s menu`)
  await entry.click()
}

// Picks `item` from the menu in the header of the folder shown.
export const pickFromFolderMenu = async (page: Page, item: string) => {
  const trigger = page
    .locator(`xpath=//*[contains(@class, "icon-gen-iconfont-ellipsis")][not(ancestor::*[@data-testid="${T.FILES_ROW}"])]`)
    .locator('visible=true')
    .first()
  const entry = page.getByText(item, {exact: true}).locator('visible=true')
  await openMenu(page, trigger, entry, "the folder's menu")
  await entry.click()
}

// Makes `folder` with the app's New folder, in the folder above it, and checks the CLI sees it.
export const makeFolderInApp = async (page: Page, folder: string) => {
  const parent = folder.slice(0, folder.lastIndexOf('/'))
  const name = leaf(folder)
  await openKbfsFolder(page, parent)
  await pickFromFolderMenu(page, 'New folder')
  const input = page.getByTestId(T.FILES_EDITING_ROW).locator('input')
  await input.fill(name)
  await input.press('Enter')
  await expect(filesRow(page, name), 'the new folder row').toHaveCount(1, {timeout: 20_000})
  await expect.poll(async () => (await kbfsEntry(parent, name))?.isDir, {message: `${folder} from the CLI`, timeout: 30_000}).toBe(true)
}

// Makes `folder` in the app, copies `files` (name to local file) into it from the CLI, and opens it.
export const workFolderWith = async (page: Page, folder: string, files: Record<string, string> = {}, dirs: ReadonlyArray<string> = []) => {
  await makeFolderInApp(page, folder)
  for (const d of dirs) await kbfsMkdir(`${folder}/${d}`)
  for (const [name, local] of Object.entries(files)) await kbfsCopyIn(local, `${folder}/${name}`)
  await openKbfsFolder(page, folder)
  const entries = [...dirs, ...Object.keys(files)]
  // the listing has loaded before the test changes the folder
  if (!entries.length) await expect(page.getByText('This folder is empty.', {exact: true}).locator('visible=true')).toHaveCount(1, {timeout: 20_000})
  for (const name of entries) await expect(filesRow(page, name), `the row ${name}`).toHaveCount(1, {timeout: 20_000})
  return folder
}

// Opening the smoke+second folder makes the service show the second account's tracker popup ("You
// accessed a folder for private team"): closes each with its close button.
export const closeSecondTrackerPopups = async (page: Page) => {
  const {secondUser} = loadE2EAccounts()
  const open = () =>
    page
      .context()
      .pages()
      .filter(p => !p.isClosed() && p.url().includes('component=tracker') && new URL(p.url()).searchParams.get('param') === secondUser)
  for (const popup of open()) await popup.locator('.icon-gen-iconfont-close').first().click({timeout: 5_000})
  await expect.poll(() => open().length, {message: "the second account's tracker popups", timeout: 10_000}).toBe(0)
}

// The row of an entry an upload just made, then its size from the CLI. A missing row fails saying
// whether the service has the file (the app's listing missing it) or not (no upload landed).
export const expectUploadedRow = async (page: Page, folder: string, name: string, size: number) => {
  const shown = await expect(filesRow(page, name))
    .toHaveCount(1, {timeout: 60_000})
    .then(
      () => true,
      () => false
    )
  if (!shown) {
    const listed = await kbfsEntry(folder, name)
    throw new Error(
      listed
        ? `the row ${name}: the CLI lists the file (${listed.size} bytes), but the app's listing of the folder does not show it`
        : `the row ${name}: not shown, and the CLI does not list the file either`
    )
  }
  await expect.poll(async () => (await kbfsEntry(folder, name))?.size, {message: `${name} from the CLI`, timeout: 60_000}).toBe(size)
}
