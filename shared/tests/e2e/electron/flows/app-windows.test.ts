// The app's other windows, opened the way the app opens them: the menubar widget sends the main
// window to a tab or a recent file, and its menu offers Quit (a manual edge: quitting stops the
// service the run needs); the tracker popup shows the second account.
import {randomBytes} from 'crypto'
import * as fs from 'fs'
import type {Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {closeSecondTrackerPopups, kbfsCopyIn, kbfsEntry, leaf, removeOwnKbfs, smokeFolder, stampedEntry} from '@/tests/e2e/electron/helpers/files'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {focusedRoute, navigateToChat, navigateToFiles, navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {manualEdge, step} from '@/tests/e2e/electron/helpers/step'
import {closeRemoteWindow, openRemoteWindow} from '@/tests/e2e/electron/helpers/windows'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

test.afterEach(async () => {
  await requireMainIsSmoke(loadE2EAccounts())
})

const focusedScreen = async (page: Page) => (await focusedRoute(page)).names.at(-1)

// Each tab's stack at its root, the main window on People, so a press that does nothing shows.
const mainOnPeople = async (page: Page) => {
  await navigateToFiles(page)
  await navigateToChat(page)
  await navigateToPeople(page)
  await expect.poll(async () => focusedScreen(page), {timeout: 5_000}).toBe('peopleRoot')
}

test('menubar opens the main window on chat and files', async ({page}, testInfo) => {
  await mainOnPeople(page)
  const menubar = await openRemoteWindow(page.context(), page, 'menubar')
  try {
    await expect(menubar.getByTestId(T.MENUBAR_TAB_CHAT)).toBeVisible({timeout: 10_000})
    await step(menubar, testInfo, 'menubar widget', {card: true})
    await menubar.getByTestId(T.MENUBAR_TAB_CHAT).click()
    await expect.poll(async () => focusedScreen(page), {message: 'the main window after the widget chat icon', timeout: 10_000}).toBe('chatRoot')
    await step(page, testInfo, 'main window on chat')
    await menubar.getByTestId(T.MENUBAR_TAB_FILES).click()
    await expect.poll(async () => focusedScreen(page), {message: 'the main window after the widget files icon', timeout: 10_000}).toBe('fsRoot')
    await step(page, testInfo, 'main window on files')
  } finally {
    await closeRemoteWindow(menubar)
  }
})

type EditHistory = Array<{history?: Array<{edits?: Array<{filename: string}> | null}> | null}> | null
// Whether the service's edit history (what the widget's recent files load) lists `name`. It lags a
// write by a second or more, and the widget loads its list once per show, so a show before the
// history has the file would never list it.
const inEditHistory = async (name: string) =>
  ((await mainRpc<EditHistory>('keybase.1.SimpleFS.simpleFSUserEditHistory', {})) ?? []).some(f =>
    (f.history ?? []).some(w => (w.edits ?? []).some(e => e.filename.endsWith(`/${name}`)))
  )

// A new file in the smoke account's private folder, copied in from the CLI (setup, not coverage),
// for `body` once the service's edit history lists it; removed after it, with a read-back.
const withUploadedFile = async (body: (path: string, name: string) => Promise<void>, after: ReadonlyArray<() => Promise<unknown>>) => {
  const name = stampedEntry(`menubar-${randomBytes(2).toString('hex')}.txt`)
  const path = `${smokeFolder()}/${name}`
  const local = `/tmp/kb-e2e/${name}`
  await withCleanup(
    async () => {
      fs.mkdirSync('/tmp/kb-e2e', {recursive: true})
      fs.writeFileSync(local, `${name}\n`)
      await kbfsCopyIn(local, path)
      await expect.poll(async () => (await kbfsEntry(smokeFolder(), name))?.isDir, {message: `${path} from the CLI`, timeout: 30_000}).toBe(false)
      await expect.poll(async () => inEditHistory(name), {message: `${name} in the service's edit history`, timeout: 60_000}).toBe(true)
      await body(path, name)
    },
    [async () => removeOwnKbfs(path), async () => fs.promises.rm(local, {force: true}), ...after]
  )
}

// A file's row in the widget's recent files: a name is drawn as its stem and its extension side
// by side.
const recentFileRow = (menubar: Page, name: string) => menubar.getByTestId(T.MENUBAR_FILE_ROW).filter({hasText: name.replace(/\.txt$/, '')})

type ConfigStore = {getState: () => {windowShownCount: Map<string, number>}}
// How many times the main window has seen the tray's window shown.
const menuShownCount = async (page: Page) =>
  page.evaluate(() => {
    const store = (globalThis as unknown as {__ZUSTAND_HMR__?: Map<string, unknown>}).__ZUSTAND_HMR__?.get('config') as ConfigStore | undefined
    if (!store) throw new Error('the config store is not in __ZUSTAND_HMR__; is this a dev build?')
    return store.getState().windowShownCount.get('menu') ?? 0
  })

// The widget loads its recent files each time it is shown (as the tray shows it), so a file
// written while it was hidden is listed at its next show.
test('menubar recent files list a file written since the last show', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  let menubar: Page | undefined
  const closeMenubar = async () => {
    const m = menubar
    menubar = undefined
    if (m) await closeRemoteWindow(m)
  }
  // a first show loads the list
  try {
    menubar = await openRemoteWindow(page.context(), page, 'menubar')
    await expect(menubar.getByText('Recent files', {exact: true})).toBeVisible({timeout: 10_000})
    await expect(menubar.getByTestId(T.MENUBAR_TLF_ROW).first(), 'the recent files from the first show').toBeVisible({timeout: 30_000})
  } finally {
    await closeMenubar()
  }
  await withUploadedFile(
    async (_path, name) => {
      const before = await menuShownCount(page)
      menubar = await openRemoteWindow(page.context(), page, 'menubar')
      expect(await menuShownCount(page), "the main window's count of tray shows after the next show").toBe(before + 1)
      await expect(recentFileRow(menubar, name), `${name} in the widget's recent files at its next show`).toHaveCount(1, {timeout: 60_000})
      await step(menubar, testInfo, 'recent files list the new file', {card: true})
    },
    [closeMenubar]
  )
})

test('menubar recent file opens it in the main window', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  let menubar: Page | undefined
  await withUploadedFile(
    async (path, name) => {
      await mainOnPeople(page)
      menubar = await openRemoteWindow(page.context(), page, 'menubar')
      const row = recentFileRow(menubar, name)
      await expect(row, `${name} in the widget's recent files`).toHaveCount(1, {timeout: 60_000})
      await step(menubar, testInfo, 'recent files list the file', {card: true})
      await row.click()
      await expect
        .poll(async () => focusedRoute(page), {message: 'the main window after the recent file', timeout: 15_000})
        .toMatchObject({names: expect.arrayContaining(['fsBrowse']) as unknown, params: {path}})
      await expect(page.getByText(leaf(path), {exact: true}).locator('visible=true').first()).toBeVisible({timeout: 10_000})
      await step(page, testInfo, 'main window shows the file')
    },
    [async () => menubar && closeRemoteWindow(menubar), async () => navigateToFiles(page)]
  )
})

test('menubar quit', async ({page}, testInfo) => {
  const menubar = await openRemoteWindow(page.context(), page, 'menubar')
  try {
    const quit = menubar.getByText('Quit Keybase', {exact: true})
    await openMenu(menubar, menubar.getByTestId(T.MENUBAR_MENU_BUTTON), quit, "the widget's menu")
    // pressing Quit stops the app and the service the run uses
    await manualEdge(menubar, testInfo, 'quit-app')
  } finally {
    // closing the window takes its menu with it
    await closeRemoteWindow(menubar)
  }
})

test('tracker window shows second', async ({page}, testInfo) => {
  const {secondUser} = loadE2EAccounts()
  // the service's own tracker popups for second (opening the smoke+second folder makes them)
  await closeSecondTrackerPopups(page)
  const tracker = await openRemoteWindow(page.context(), page, 'tracker', {reason: 'You looked at this user', username: secondUser})
  try {
    await expect(tracker.getByTestId(T.TRACKER_BUTTONS)).toBeVisible({timeout: 30_000})
    await expect(tracker.getByText(secondUser, {exact: true}).first()).toBeVisible()
    await expect(tracker.getByText('You looked at this user', {exact: true}).first()).toBeVisible()
    // the tracker has no devices section: the loaded identify shows as the follower counts
    await expect(tracker.getByText(/^\d+ Followers/).first(), "the second account's follower count").toBeVisible({timeout: 10_000})
    await step(tracker, testInfo, 'tracker shows second', {card: true})
  } finally {
    await closeRemoteWindow(tracker)
  }
})
