// A subteam's custom emoji from the app: one added from an image (picked through the native open
// dialog, stubbed to hand back a corpus image), given an alias, and both removed again. The emoji
// carry this run's stamp (stampedEmojiName) so the sweeper clears any a crashed run leaves; the
// subteam is this test's own and is deleted after.
import type {Page} from '@playwright/test'
import {test, expect, e2eRunId} from '@/tests/e2e/electron/helpers/fixtures'
import {stampedEmojiName} from '@/tests/e2e/accounts/run-id'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {connectMainProcess} from '@/tests/e2e/electron/helpers/main-process'
import {openMenu} from '@/tests/e2e/electron/helpers/menu'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {step} from '@/tests/e2e/electron/helpers/step'
import {
  deleteSubteamIfPresent,
  mainRead,
  makeSubteam,
  menuItem,
  modalRoot,
  openSubteamTab,
  requireThisRunSubteam,
  rowMenuButton,
  runChatApi,
} from '@/tests/e2e/electron/helpers/teams'
import {CORPUS_DIR} from '@/tests/e2e/fixtures/corpus/corpus'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

test.beforeEach(async ({page}) => {
  await closeLeftoverModals(page)
})
test.afterEach(async ({page}) => {
  await closeLeftoverModals(page)
})

type UserEmojiRes = {emojis?: {emojis?: Array<{name: string; emojis?: Array<{alias: string}> | null}> | null}}
// The aliases of a team's emoji, as the main service lists them for the smoke account.
const teamEmojis = async (team: string) => {
  const res = await mainRead<UserEmojiRes>('chat.1.local.userEmojis', {
    convID: null,
    opts: {getAliases: true, getCreationInfo: false, onlyInTeam: false},
  })
  return (res.emojis?.emojis ?? []).filter(g => g.name === team).flatMap(g => (g.emojis ?? []).map(e => e.alias))
}

const emojiTab = (page: Page) => page.getByTestId(T.TEAMS_EMOJI_TAB).locator('visible=true').first()

// Picks `title` from an emoji row's menu.
const fromRowMenu = async (page: Page, alias: string, title: string) => {
  const row = emojiTab(page).getByText(`:${alias}:`, {exact: true})
  await expect(row, `:${alias}: in the emoji tab`).toBeVisible({timeout: 20_000})
  await row.hover()
  const item = menuItem(page, title)
  await openMenu(page, rowMenuButton(emojiTab(page), `:${alias}:`), item, `the :${alias}: menu`)
  await item.click()
}

test('add, alias and remove an emoji', async ({page}, testInfo) => {
  test.setTimeout(300_000)
  const emoji = stampedEmojiName('a', e2eRunId())
  const alias = stampedEmojiName('b', e2eRunId())
  const seed = stampedEmojiName('s', e2eRunId())
  const {name} = await makeSubteam('emo')
  await withCleanup(async () => {
    expect(await teamEmojis(name), 'a new subteam has no emoji').toEqual([])
    // The tab offers Add emoji before it knows the team's conversation, and a modal opened then can
    // never add (an owner-report finding). The tab lists the team's emoji only once it knows the
    // conversation: an emoji added through the CLI first, and listed, says it does.
    requireThisRunSubteam(name)
    await runChatApi('emojiadd', {
      alias: seed,
      channel: {members_type: 'team', name, topic_name: 'general'},
      filename: `${CORPUS_DIR}/e2e-c.png`,
    })
    await expect.poll(async () => teamEmojis(name), {message: 'the seeded emoji', timeout: 30_000}).toEqual([seed])
    await openSubteamTab(page, name, T.TEAMS_TAB_EMOJI_BUTTON)
    await expect(emojiTab(page).getByText(`:${seed}:`, {exact: true}), 'the tab lists the seeded emoji').toBeVisible({timeout: 30_000})
    const input = modalRoot(page).locator('input:visible').first()
    const add = modalRoot(page).locator('.button--primary', {hasText: 'Add emoji'}).locator('visible=true').last()
    await emojiTab(page).getByText('Add emoji', {exact: true}).first().click()
    await expect(modalRoot(page).getByText('Drag and drop images or', {exact: true})).toBeVisible({timeout: 10_000})
    // the app picks images through Electron's open dialog, which the stub answers
    await (await connectMainProcess()).stubOpenDialog([`${CORPUS_DIR}/e2e-c.png`])
    await modalRoot(page).getByText('browse your computer', {exact: true}).click()
    await expect(modalRoot(page).getByText(/^Choose (an alias for this emoji|aliases for these emoji):$/)).toBeVisible({timeout: 15_000})
    await input.fill(emoji)
    await expect(add, 'Add emoji enabled').not.toHaveClass(/button--disabled/)
    await step(page, testInfo, 'emoji named')
    await add.click()
    await expect(input).toHaveCount(0, {timeout: 30_000})
    await expect.poll(async () => (await teamEmojis(name)).sort(), {message: 'the subteam emoji after Add', timeout: 30_000}).toEqual([seed, emoji].sort())
    await expect(emojiTab(page).getByText(`:${emoji}:`, {exact: true}), 'the emoji in the emoji tab').toBeVisible({timeout: 20_000})
    await step(page, testInfo, 'emoji added')

    await fromRowMenu(page, emoji, 'Add alias')
    const aliasInput = modalRoot(page).locator('input:visible').first()
    await expect(aliasInput).toBeVisible({timeout: 10_000})
    await aliasInput.fill(alias)
    await modalRoot(page).locator('.button--primary', {hasText: 'Add an alias'}).locator('visible=true').last().click()
    await expect(aliasInput).toHaveCount(0, {timeout: 30_000})
    await expect.poll(async () => (await teamEmojis(name)).sort(), {message: 'the subteam emoji after the alias', timeout: 30_000}).toEqual([seed, emoji, alias].sort())
    await step(page, testInfo, 'alias added')

    await fromRowMenu(page, alias, 'Delete alias')
    await expect.poll(async () => (await teamEmojis(name)).sort(), {message: 'the subteam emoji after Delete alias', timeout: 30_000}).toEqual([seed, emoji].sort())
    await fromRowMenu(page, emoji, 'Delete emoji')
    await expect.poll(async () => teamEmojis(name), {message: 'the subteam emoji after Delete emoji', timeout: 30_000}).toEqual([seed])
    await expect(emojiTab(page).getByText(`:${seed}:`, {exact: true}), 'the seeded emoji still listed').toBeVisible()
    await expect(emojiTab(page).getByText(`:${emoji}:`, {exact: true})).toHaveCount(0, {timeout: 20_000})
    await step(page, testInfo, 'emoji removed')
  }, [async () => deleteSubteamIfPresent(name)])
})
