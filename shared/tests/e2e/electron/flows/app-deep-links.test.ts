// keybase:// links, handed to the app as the OS hands them (the main process's open-url event), open
// their screen in the main window: a team channel, a team page, a profile, a private folder; a
// malformed one opens the link error. Every link names only the test accounts, the e2e team or the
// smoke account's own folder.
import type {Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {threadHeaderTitle} from '@/tests/e2e/electron/helpers/chat'
import {expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {pressHeaderBack} from '@/tests/e2e/electron/helpers/accounts'
import escapeRegExp from 'lodash/escapeRegExp'
import {focusedRoute, navigateToChat, navigateToFiles, navigateToTeams} from '@/tests/e2e/electron/helpers/navigate'
import {step} from '@/tests/e2e/electron/helpers/step'
import {teamID} from '@/tests/e2e/electron/helpers/teams'
import {E2E_CHANNELS} from '@/tests/e2e/shared/chat-data'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

test.afterEach(async () => {
  await requireMainIsSmoke(loadE2EAccounts())
})

const openLink = async (link: string) => (await connectMainProcess()).openUrl(link)

// The main window's focused screen and its params, once it is `name`.
const expectScreen = async (page: Page, name: string, params: object, what: string) => {
  await expect
    .poll(async () => {
      const r = await focusedRoute(page)
      return {name: r.names.at(-1), params: r.params}
    }, {message: what, timeout: 15_000})
    .toMatchObject({name, params})
}

// Back on People at its root: a team page or profile link pushes its screen onto the tab shown.
// Each link pushes one screen, so one press of its back arrow leaves it.
const peopleAtRoot = async (page: Page) => {
  await page.getByTestId(T.NAV_TAB_PEOPLE).click()
  await expect.poll(async () => (await focusedRoute(page)).names.includes('tabs.peopleTab'), {message: 'the People tab', timeout: 5_000}).toBe(true)
  if ((await focusedRoute(page)).names.at(-1) !== 'peopleRoot') await pressHeaderBack(page)
  await expect.poll(async () => (await focusedRoute(page)).names.at(-1), {message: 'the People tab at its root', timeout: 10_000}).toBe('peopleRoot')
}

// Starts on People, every tab at its root, so the link is what moves the window.
const fromPeople = async (page: Page) => {
  await navigateToChat(page)
  await navigateToTeams(page)
  await navigateToFiles(page)
  await peopleAtRoot(page)
}

test('a team channel link selects the channel', async ({page}, testInfo) => {
  const {team} = loadE2EAccounts()
  await fromPeople(page)
  await openLink(`keybase://chat/${team}#${E2E_CHANNELS.scratch}`)
  await expect(threadHeaderTitle(page), 'the thread the link opened').toHaveText(`${team}#${E2E_CHANNELS.scratch}`, {timeout: 15_000})
  await expectScreen(page, 'chatRoot', {}, 'the main window after the channel link')
  await expect(page.getByTestId(T.CHAT_MESSAGE_LIST)).toBeVisible()
  await step(page, testInfo, 'channel link opened the scratch channel', {card: true})
})

test('a team page link opens the team', async ({page}, testInfo) => {
  const {team} = loadE2EAccounts()
  await fromPeople(page)
  await openLink(`keybase://team-page/${team}`)
  await expectScreen(page, 'team', {teamID: await teamID(team)}, 'the main window after the team page link')
  await expect(page.locator('.text_Header').filter({hasText: new RegExp(`^${escapeRegExp(team)}$`)}).locator('visible=true').first()).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'team page link opened the team', {card: true})
  await peopleAtRoot(page)
})

test('a profile link opens the profile', async ({page}, testInfo) => {
  const {secondUser} = loadE2EAccounts()
  await fromPeople(page)
  await openLink(`keybase://profile/show/${secondUser}`)
  await expectScreen(page, 'profile', {username: secondUser}, 'the main window after the profile link')
  await expect(page.getByTestId(T.PROFILE_PAGE).locator('visible=true').first()).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'profile link opened second', {card: true})
  await peopleAtRoot(page)
})

test('a private folder link opens the folder', async ({page}, testInfo) => {
  const {smokeUser} = loadE2EAccounts()
  await fromPeople(page)
  try {
    await openLink(`keybase://private/${smokeUser}`)
    await expectScreen(page, 'fsBrowse', {path: `/keybase/private/${smokeUser}`}, 'the main window after the folder link')
    await expect(page.getByTestId(T.FILES_ROW).locator('visible=true').first(), "the folder's listing").toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'folder link opened the private folder', {card: true})
  } finally {
    // the Files tab back at its root
    await navigateToFiles(page)
  }
})

test('a malformed link opens the link error', async ({page}, testInfo) => {
  const {team} = loadE2EAccounts()
  await fromPeople(page)
  // two channel separators: no channel to open
  await openLink(`keybase://chat/${team}#${E2E_CHANNELS.scratch}#x`)
  await expectScreen(page, 'keybaseLinkError', {}, 'the main window after the malformed link')
  await expect(page.getByTestId(T.KEYBASE_LINK_ERROR)).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'link error', {card: true})
  // a screen pushed onto the tab shown, which its back arrow leaves
  await pressHeaderBack(page)
  await expect(page.getByTestId(T.KEYBASE_LINK_ERROR).locator('visible=true')).toHaveCount(0, {timeout: 5_000})
  await peopleAtRoot(page)
})
