// The Files tab: opening folders, rows and their menus, and the KBFS entries the files flows make.
// Every entry a flow makes or deletes is run-stamped (e2e-<runid>-<label>) and sits directly in the
// smoke account's private folder or the smoke+second folder; a delete targets one exact such path
// of this run (or something inside it) and nothing else.
import {randomBytes} from 'crypto'
import {expect, type Locator, type Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {parseStampedName} from '@/tests/e2e/accounts/run-id'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import {requireMainIsSmoke, runKeybase} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'
import {e2eRunId} from './fixtures'
import {openMenu} from './menu'
import {retriedNavigation} from './step'

export const smokeFolder = () => `/keybase/private/${loadE2EAccounts().smokeUser}`
export const pairFolder = () => {
  const {smokeUser, secondUser} = loadE2EAccounts()
  return `/keybase/private/${[smokeUser, secondUser].sort().join(',')}`
}

// Whether the smoke+second folder is in the smoke account's favorites or its ignored folders.
// Blocking the second account ignores it, and unblocking leaves it ignored.
type FavoriteFolder = {name: string; folderType: number}
const privateFolderType = 1
const pairName = () => pairFolder().slice(pairFolder().lastIndexOf('/') + 1)
export const pairFavoriteState = async () => {
  const res = await mainRpc<{favoriteFolders: Array<FavoriteFolder> | null; ignoredFolders: Array<FavoriteFolder> | null}>(
    'keybase.1.favorite.getFavorites',
    {}
  )
  const has = (list: Array<FavoriteFolder> | null) => !!list?.some(f => f.name === pairName() && f.folderType === privateFolderType)
  return {favorite: has(res.favoriteFolders), ignored: has(res.ignoredFolders)}
}

// Makes the smoke+second folder a favorite again (it was one before the flow), and reads that back.
export const refavoritePair = async () => {
  await mainRpc('keybase.1.favorite.favoriteAdd', {folder: {created: false, folderType: privateFolderType, name: pairName()}})
  await expect.poll(pairFavoriteState, {message: 'the smoke+second folder after favoriteAdd', timeout: 20_000}).toEqual({favorite: true, ignored: false})
}

// e2e-<runid>-<label>, the name of an entry a flow makes.
export const stampedEntry = (label: string) => {
  const name = `e2e-${e2eRunId()}-${label}`
  if (parseStampedName(name, 'dashed')?.runId !== e2eRunId()) throw new Error(`${name} is not a stamped name of this run`)
  return name
}

const safeName = /^[A-Za-z0-9_.-]+$/

// `path`, when it is an entry this run made in one of the two folders flows write to, or something
// inside one; throws otherwise. `keybase fs` expands globs, so every name in it must be plain.
const requireOwnPath = (path: string) => {
  const root = [smokeFolder(), pairFolder()].find(r => path.startsWith(`${r}/`))
  if (!root) throw new Error(`refusing ${path}: not in ${smokeFolder()} or ${pairFolder()}`)
  const parts = path.slice(root.length + 1).split('/')
  if (!parts.every(p => safeName.test(p) && p !== '.' && p !== '..')) throw new Error(`refusing ${path}: not a plain path`)
  if (parseStampedName(parts[0] ?? '', 'dashed')?.runId !== e2eRunId()) throw new Error(`refusing ${path}: not under an entry of run ${e2eRunId()}`)
  return path
}

const kbfsTimeoutMs = 60_000

export type KbfsEntry = {name: string; isDir: boolean; size: number}

// `keybase fs ls -w` lines (tab-separated, so a name may hold spaces): `<time>\t<DIR>\t\t<name>` for
// a directory, `<time>\t<size>\t<name>` for a file.
export const kbfsList = async (dir: string): Promise<Array<KbfsEntry>> => {
  if (dir !== smokeFolder() && dir !== pairFolder()) requireOwnPath(dir)
  const out = await runKeybase(['fs', 'ls', '-w', '-a', '--nocolor', dir], {timeoutMs: kbfsTimeoutMs})
  return out
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      const fields = l.split('\t')
      const isDir = fields[1] === '<DIR>'
      return {isDir, name: fields[fields.length - 1] ?? '', size: isDir ? 0 : Number(fields[1])}
    })
    .filter(e => e.name !== '.' && e.name !== '..')
}

export const kbfsEntry = async (dir: string, name: string) => (await kbfsList(dir)).find(e => e.name === name)

export const kbfsMkdir = async (path: string) => {
  await runKeybase(['fs', 'mkdir', requireOwnPath(path)], {timeoutMs: kbfsTimeoutMs})
}

// Copies a local file in as `path` (setup only: flows never count it as coverage).
export const kbfsCopyIn = async (localFile: string, path: string) => {
  await runKeybase(['fs', 'cp', localFile, requireOwnPath(path)], {timeoutMs: kbfsTimeoutMs})
}

const parentAndName = (path: string) => {
  const i = path.lastIndexOf('/')
  return {dir: path.slice(0, i), name: path.slice(i + 1)}
}

// Removes `path` (with what is in it) when it is there, and reads back that it is gone.
export const removeOwnKbfs = async (path: string) => {
  requireOwnPath(path)
  const {dir, name} = parentAndName(path)
  if (!(await kbfsEntry(dir, name))) return
  // a recursive delete runs as whoever the main service is signed in as: checked right before it
  await requireMainIsSmoke(loadE2EAccounts())
  await runKeybase(['fs', 'rm', '-r', path], {timeoutMs: kbfsTimeoutMs})
  if (await kbfsEntry(dir, name)) throw new Error(`${path} is still there after keybase fs rm`)
}

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

// A new folder for one test to work in (made through the app's New folder): each test, and each
// repeat of it, has its own.
export const newWorkFolder = () => `${smokeFolder()}/${stampedEntry(`files-${randomBytes(2).toString('hex')}`)}`
export const leaf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

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
