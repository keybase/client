// Link previews: the chat settings' mode radios and allow / block lists save what the service then
// reports, and links posted in the smoke user's conversation with themselves prompt, unfurl or stay
// bare as the mode and lists say. Every case reads the thread and the service (the bot API's
// getunfurlsettings) both. The account's own settings are put back afterwards, or at the start of the
// next run when this one died before it could.
import * as fs from 'fs'
import type {Locator, Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {openSelfConversation, sendMessage, signedInAs} from '@/tests/e2e/electron/helpers/chat'
import {navigateToSettings} from '@/tests/e2e/electron/helpers/navigate'
import {cliChatApi, cliWhoami} from '@/tests/e2e/shared/cli-account'
import * as T from '@/tests/e2e/shared/test-ids'

// serial: each case builds on the settings the one before saved. No retries: a retry would post
// again and could let an intermittent prompt pass.
test.describe.configure({mode: 'serial', retries: 0, timeout: 120_000})

type Mode = 'always' | 'never' | 'whitelisted'
type UnfurlSettings = {blocklist: Array<string>; mode: Mode; whitelist: Array<string>}

const smokeUser = process.env['KB_SMOKE_USER'] ?? ''
// The account's settings from before the run, kept on disk until they are put back.
const savedSettingsPath = '/tmp/kb-e2e-chat-unfurl-settings.json'
const runID = Date.now().toString(36)
// How long a link must stay bare to count as not unfurled, and the longest an unfurl may take.
const bareWindowMs = 10_000
const unfurlTimeoutMs = 30_000

const getSettings = async (): Promise<UnfurlSettings> => {
  const r = (await cliChatApi({method: 'getunfurlsettings'})) as Partial<UnfurlSettings> & {mode: Mode}
  // only a service and CLI with block lists name the field
  if (!('blocklist' in r)) throw new Error('getunfurlsettings has no blocklist: KB_CLI must be the CLI built from this branch')
  return {blocklist: [...(r.blocklist ?? [])].sort(), mode: r.mode, whitelist: [...(r.whitelist ?? [])].sort()}
}

const setSettings = async (s: UnfurlSettings) => {
  await cliChatApi({method: 'setunfurlsettings', params: {options: s}})
  expect(await getSettings()).toEqual({...s, blocklist: [...s.blocklist].sort(), whitelist: [...s.whitelist].sort()})
}

const requireSmokeUser = async () => {
  if (!smokeUser) throw new Error('KB_SMOKE_USER is not set')
  const who = await cliWhoami()
  if (who !== smokeUser) throw new Error(`the host's keybase CLI is ${who || 'signed out'}, not KB_SMOKE_USER`)
}

const restoreSavedSettings = async () => {
  if (!fs.existsSync(savedSettingsPath)) return
  const saved = JSON.parse(fs.readFileSync(savedSettingsPath, 'utf8')) as UnfurlSettings
  await setSettings(saved)
  fs.unlinkSync(savedSettingsPath)
}

test.beforeAll(async () => {
  await requireSmokeUser()
  // a run that died before its afterAll left the account's settings here
  await restoreSavedSettings()
  fs.writeFileSync(savedSettingsPath, JSON.stringify(await getSettings()))
})

test.afterAll(async () => {
  await requireSmokeUser()
  await restoreSavedSettings()
})

test.beforeEach(async ({page}) => {
  await requireSmokeUser()
  expect(await signedInAs(page)).toBe(smokeUser)
})

// -- settings ------------------------------------------------------------------------------------

const settingsChat = (page: Page) => page.getByTestId(T.SETTINGS_CHAT)

const openChatSettings = async (page: Page) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator('text=Chat').click()
  await expect(settingsChat(page)).toBeVisible({timeout: 5_000})
}

const radio = (page: Page, label: string) => settingsChat(page).getByText(label, {exact: true})
const expectRadioSelected = async (page: Page, label: string) => {
  const button = radio(page, label).locator('xpath=preceding-sibling::div[contains(@class, "radio-button")][1]')
  await expect(button).toHaveClass(/\bselected\b/, {timeout: 10_000})
}

const listSection = (page: Page, list: 'allowed' | 'blocked') =>
  page.getByTestId(list === 'allowed' ? T.SETTINGS_UNFURL_ALLOWED : T.SETTINGS_UNFURL_BLOCKED)

const addToList = async (page: Page, list: 'allowed' | 'blocked', text: string) => {
  const input = listSection(page, list).getByPlaceholder('Add a website, e.g. example.com')
  await input.fill(text, {timeout: 5_000})
  await input.press('Enter', {timeout: 5_000})
  await expect(input).toHaveValue('', {timeout: 5_000})
}

const listRow = (page: Page, list: 'allowed' | 'blocked', domain: string) =>
  listSection(page, list).getByText(domain, {exact: true})

const save = async (page: Page) => {
  const button = page.getByTestId(T.SETTINGS_UNFURL_SAVE)
  await button.click({timeout: 5_000})
}

// Reloads the app (dropping what the settings screen holds) and opens the chat settings again.
const reloadChatSettings = async (page: Page) => {
  await page.reload()
  await page.getByTestId(T.NAV_TAB_CHAT).waitFor({timeout: 30_000})
  await openChatSettings(page)
}

// -- the thread ----------------------------------------------------------------------------------

const openSelf = async (page: Page) => openSelfConversation(page, smokeUser)

const messageRow = (page: Page, marker: string) =>
  page.getByTestId(T.CHAT_MESSAGE_LIST).locator('[data-ordinal]').filter({hasText: marker})

type Posted = {at: number; marker: string; row: Locator}

// Posts a message carrying a link to `domain`, both unique to this post.
const postLink = async (page: Page, tag: string, domain: string): Promise<Posted> => {
  const marker = `e2e-unfurl-${tag}-${runID}`
  await sendMessage(page, `${marker} https://${domain}/?e2e=${tag}-${runID}`)
  return {at: Date.now(), marker, row: messageRow(page, marker)}
}

const prompt = (p: Posted) => p.row.getByTestId(T.CHAT_UNFURL_PROMPT)
const unfurl = (p: Posted) => p.row.getByTestId(T.CHAT_UNFURL_GENERIC)

const expectPromptFor = async (p: Posted, domain: string) => {
  await expect(prompt(p)).toHaveCount(1, {timeout: unfurlTimeoutMs})
  await expect(prompt(p)).toContainText('Would you like to post a preview?')
  await expect(prompt(p).getByText(`Remember for ${domain}`, {exact: true})).toBeVisible()
}

const answerPrompt = async (p: Posted, answer: 'yes' | 'no', remember: boolean) => {
  if (remember) await prompt(p).getByText(/^Remember for /).click({timeout: 5_000})
  await prompt(p)
    .getByTestId(answer === 'yes' ? T.CHAT_UNFURL_PROMPT_YES : T.CHAT_UNFURL_PROMPT_NO)
    .click({timeout: 5_000})
  await expect(prompt(p)).toHaveCount(0, {timeout: 10_000})
}

const expectUnfurled = async (p: Posted) => {
  await expect(unfurl(p)).toHaveCount(1, {timeout: unfurlTimeoutMs})
  await expect(prompt(p)).toHaveCount(0)
  return Date.now() - p.at
}

// Holds the message to no prompt and no preview until it has been up for bareWindowMs.
const expectBare = async (page: Page, p: Posted) => {
  const until = p.at + bareWindowMs
  do {
    await expect(prompt(p)).toHaveCount(0)
    await expect(unfurl(p)).toHaveCount(0)
    await page.waitForTimeout(500)
  } while (Date.now() < until)
}

// -- cases ---------------------------------------------------------------------------------------

test('Ask per domain saves normalized allow and block lists', async ({page}) => {
  await setSettings({blocklist: [], mode: 'always', whitelist: []})
  await openChatSettings(page)
  for (const label of ['Allow all', 'Ask per domain', 'Disallow all']) {
    await expect(radio(page, label)).toBeVisible()
  }
  await expectRadioSelected(page, 'Allow all')
  await expect(listSection(page, 'blocked')).toHaveCount(0)

  await radio(page, 'Ask per domain').click()
  await expectRadioSelected(page, 'Ask per domain')
  await addToList(page, 'blocked', 'https://www.Example.org/x')
  // the row is the domain the service stores, before any save
  await expect(listRow(page, 'blocked', 'example.org')).toBeVisible()
  await addToList(page, 'allowed', 'example.net')
  await save(page)

  // the service writes the mode and each list in turn, so wait for all three
  await expect
    .poll(async () => getSettings(), {timeout: 10_000})
    .toEqual({blocklist: ['example.org'], mode: 'whitelisted', whitelist: ['example.net']})
  await reloadChatSettings(page)
  await expectRadioSelected(page, 'Ask per domain')
  await expect(listRow(page, 'blocked', 'example.org')).toBeVisible({timeout: 10_000})
  await expect(listRow(page, 'allowed', 'example.net')).toBeVisible()
})

test('Allow all saves as always and stays selected', async ({page}) => {
  await openChatSettings(page)
  await expectRadioSelected(page, 'Ask per domain')
  await radio(page, 'Allow all').click()
  await expectRadioSelected(page, 'Allow all')
  await save(page)
  await expect.poll(async () => (await getSettings()).mode, {timeout: 10_000}).toBe('always')

  await reloadChatSettings(page)
  await expectRadioSelected(page, 'Allow all')
  expect((await getSettings()).mode).toBe('always')
})

test('Ask per domain: No with remember blocks an unknown domain', async ({page}) => {
  await setSettings({blocklist: ['example.org'], mode: 'whitelisted', whitelist: ['example.net']})
  await openSelf(page)
  const posted = await postLink(page, 'ask-no', 'example.com')
  await expectPromptFor(posted, 'example.com')
  await answerPrompt(posted, 'no', true)

  await expect.poll(async () => (await getSettings()).blocklist, {timeout: 10_000}).toContain('example.com')
  expect((await getSettings()).whitelist).not.toContain('example.com')
  await expectBare(page, posted)
})

test('Ask per domain: a blocked domain neither prompts nor unfurls', async ({page}) => {
  const before = await getSettings()
  expect(before.mode).toBe('whitelisted')
  expect(before.blocklist).toContain('example.com')
  expect(before.whitelist).toContain('example.net')
  await openSelf(page)
  const blocked = await postLink(page, 'blocked', 'example.com')
  // posted after it, so its preview shows the blocked link had its turn
  const control = await postLink(page, 'allowed-control', 'example.net')
  const ms = await expectUnfurled(control)
  test.info().annotations.push({description: `allowed control unfurled in ${ms}ms`, type: 'timing'})
  await expectBare(page, blocked)
  expect(await getSettings()).toEqual(before)
})

test('Ask per domain: Yes unfurls once, Yes with remember allows the domain', async ({page}) => {
  await setSettings({blocklist: ['example.org'], mode: 'whitelisted', whitelist: ['example.net']})
  const before = await getSettings()
  await openSelf(page)

  const once = await postLink(page, 'ask-yes-once', 'example.com')
  await expectPromptFor(once, 'example.com')
  await answerPrompt(once, 'yes', false)
  await expectUnfurled(once)
  expect(await getSettings()).toEqual(before)

  const remembered = await postLink(page, 'ask-yes-remember', 'example.com')
  await expectPromptFor(remembered, 'example.com')
  await answerPrompt(remembered, 'yes', true)
  await expectUnfurled(remembered)
  await expect.poll(async () => (await getSettings()).whitelist, {timeout: 10_000}).toContain('example.com')
  expect((await getSettings()).blocklist).toEqual(['example.org'])
})

test('Allow all unfurls a blocked domain without asking', async ({page}) => {
  await setSettings({blocklist: ['example.com', 'example.org'], mode: 'always', whitelist: ['example.net']})
  await openSelf(page)
  const posted = await postLink(page, 'always-blocked', 'example.com')
  await expectUnfurled(posted)
  expect((await getSettings()).blocklist).toContain('example.com')
})

test('Disallow all neither prompts nor unfurls an allowed domain', async ({page}) => {
  await setSettings({blocklist: ['example.org'], mode: 'never', whitelist: ['example.net']})
  await openSelf(page)
  const posted = await postLink(page, 'never-allowed', 'example.net')
  await expectBare(page, posted)
  expect((await getSettings()).mode).toBe('never')
})
