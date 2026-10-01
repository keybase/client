// The desktop composer, read off the textarea, the inbox and the thread: drafts survive leaving and
// a reload, a send takes the text and the draft with it, an edit is never a draft, the suggestion
// lists take their keys, newlines go in at the caret and undo, an emoji lands at the caret, and a
// read-only channel takes nothing.
import type {Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {
  clickUnoccluded,
  closeMenu,
  composer,
  composerInput,
  focusThreadScroller,
  focusedElement,
  inboxRow,
  messageMenu,
  openConversationByName,
  openSelfConversation,
  requireAttachedApp,
  requireAttachedAppAsEither,
  sendMessage,
  suggestionRows,
  switchAccount,
  threadHeaderTitle,
  waitForRow,
  watchOutgoingRpcs,
} from '@/tests/e2e/electron/helpers/chat'
import {
  E2E_CHANNELS,
  botCommands,
  createThrowawayChannel,
  deleteThrowawayChannels,
  ensureChatData,
  type ChatData,
} from '@/tests/e2e/shared/chat-data'
import {cliWhoami} from '@/tests/e2e/shared/cli-account'
import {findChannelOwner, switchAttachedApp} from '@/tests/e2e/shared/incoming-sender'
import * as T from '@/tests/e2e/shared/test-ids'

// no retries: a retry would let an intermittent race pass
test.describe.configure({retries: 0})

let data: ChatData

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await ensureChatData()
})

const editBar = (page: Page) => page.getByTestId(T.CHAT_EDIT_CANCEL)
const replyPreview = (page: Page) => page.getByTestId(T.CHAT_REPLY_PREVIEW)
const suggestionList = (page: Page) => page.getByTestId(T.CHAT_SUGGESTION_LIST)

const expectComposerText = async (page: Page, text: string) => {
  await expect.poll(async () => composer.getText(page), {timeout: 5_000}).toBe(text)
}

// Ends whatever the composer holds (an edit, a reply, text) and saves an empty draft.
const resetComposer = async (page: Page) => {
  if (!(await composerInput(page).count())) return
  if (await editBar(page).count()) await clickUnoccluded(editBar(page))
  if (await replyPreview(page).count()) await clickUnoccluded(page.getByTestId(T.CHAT_REPLY_CANCEL))
  await expect(editBar(page)).toHaveCount(0, {timeout: 5_000})
  await expect(replyPreview(page)).toHaveCount(0, {timeout: 5_000})
  if ((await composer.getText(page)) !== '') await composerInput(page).fill('', {timeout: 5_000})
  await expectComposerText(page, '')
}

const openSelf = async (page: Page) => openSelfConversation(page, data.smokeUser)
const openScratch = async (page: Page) => openConversationByName(page, data.team, E2E_CHANNELS.scratch)

// The self conversation's inbox row: a small row, which shows a saved draft as "Draft: <text>"
// while another conversation is open.
const selfRow = (page: Page) => inboxRow(page, data.smokeUser)

const expectSelfDraft = async (page: Page, draft: string | undefined) => {
  const row = selfRow(page)
  await expect(row).toHaveCount(1, {timeout: 10_000})
  if (draft === undefined) {
    await expect(row).not.toContainText('Draft:', {timeout: 5_000})
  } else {
    // text content, so no line break between the label and the draft
    await expect(row).toContainText(`Draft:${draft}`, {timeout: 5_000})
  }
}

// Types into the composer key by key, as a user does.
const typeInComposer = async (page: Page, text: string) => {
  await composer.focus(page)
  await page.keyboard.type(text)
}

// The message's text as the thread shows it. Found by its text: a row sent this session is
// renumbered when the thread loads again.
const messageText = async (page: Page, text: string) => {
  await waitForRow(page, text)
  return (await page.getByTestId(T.CHAT_MESSAGE_LIST).locator('[data-ordinal]').filter({hasText: text}).innerText({timeout: 5_000})).trim()
}

test.describe('drafts', () => {
  test.afterEach(async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
  })

  test('a draft survives a conversation switch and an app reload', async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
    const draft = `e2e-composer-draft-${Date.now()}`
    await typeInComposer(page, draft)

    await openScratch(page)
    await expectSelfDraft(page, draft)
    await openSelf(page)
    await expectComposerText(page, draft)

    // leave again so the draft is flushed to the service, then reload
    await openScratch(page)
    await expectSelfDraft(page, draft)
    await page.reload()
    await page.getByTestId(T.NAV_TAB_CHAT).waitFor({timeout: 30_000})
    await openScratch(page)
    await expectSelfDraft(page, draft)
    await openSelf(page)
    await expectComposerText(page, draft)
  })

  test('a send clears the composer and the saved draft', async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
    const text = `e2e-composer-send-${Date.now()}`
    await typeInComposer(page, text)
    await composer.press(page, 'Enter')
    await waitForRow(page, text)
    await expectComposerText(page, '')

    await openScratch(page)
    await expectSelfDraft(page, undefined)
    await expect(selfRow(page)).toContainText(text)
    await openSelf(page)
    await expectComposerText(page, '')
  })

  test('typing straight after a send is not erased', async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
    const text = `e2e-composer-quick-${Date.now()}`
    await typeInComposer(page, text)
    await composer.press(page, 'Enter')
    await page.keyboard.type('next')
    await waitForRow(page, text)
    // the sent row has landed and the list has settled; what was typed after the send is all there
    await page.waitForTimeout(500)
    await expectComposerText(page, 'next')
  })
})

test.describe('editing', () => {
  test.afterEach(async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
  })

  test('ArrowUp on an empty composer edits the last message, and Escape cancels it', async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
    const text = `e2e-composer-arrowup-${Date.now()}`
    await sendMessage(page, text)

    await composer.press(page, 'ArrowUp')
    await expect(editBar(page)).toBeVisible({timeout: 5_000})
    await expectComposerText(page, text)

    await composer.press(page, 'Escape')
    await expect(editBar(page)).toHaveCount(0, {timeout: 5_000})
    await expectComposerText(page, '')
    expect(await messageText(page, text)).toBe(text)
  })

  test('leaving mid-edit discards the edit and saves no draft', async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
    const text = `e2e-composer-leave-${Date.now()}`
    await sendMessage(page, text)

    await composer.press(page, 'ArrowUp')
    await expect(editBar(page)).toBeVisible({timeout: 5_000})
    await page.keyboard.type(' changed')
    await expectComposerText(page, `${text} changed`)
    // well past the draft save's throttle, so a save of the edit text would have gone out
    await page.waitForTimeout(500)

    await openScratch(page)
    await expectSelfDraft(page, undefined)
    await openSelf(page)
    await expect(editBar(page)).toHaveCount(0)
    await expectComposerText(page, '')
    expect(await messageText(page, text)).toBe(text)
  })

  test('leaving mid-edit keeps the draft from before the edit', async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
    const text = `e2e-composer-leave-draft-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    const draft = `e2e-composer-pre-edit-${Date.now()}`
    await typeInComposer(page, draft)

    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Edit', {exact: true}))
    await expect(editBar(page)).toBeVisible({timeout: 5_000})
    await expectComposerText(page, text)
    await composer.focus(page)
    await page.keyboard.press('End')
    await page.keyboard.type(' changed')
    await expectComposerText(page, `${text} changed`)
    await page.waitForTimeout(500)

    await openScratch(page)
    await expectSelfDraft(page, draft)
    await openSelf(page)
    await expect(editBar(page)).toHaveCount(0)
    await expectComposerText(page, draft)
    expect(await messageText(page, text)).toBe(text)
  })

  test('cancelling an edit puts the draft from before it back', async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
    const text = `e2e-composer-cancel-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    const draft = `e2e-composer-pre-cancel-${Date.now()}`
    await typeInComposer(page, draft)

    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Edit', {exact: true}))
    await expect(editBar(page)).toBeVisible({timeout: 5_000})
    await composer.focus(page)
    await page.keyboard.press('End')
    await page.keyboard.type(' changed')
    await page.waitForTimeout(500)

    await clickUnoccluded(editBar(page))
    await expect(editBar(page)).toHaveCount(0, {timeout: 5_000})
    await expectComposerText(page, draft)

    await openScratch(page)
    await expectSelfDraft(page, draft)
    await openSelf(page)
    await expectComposerText(page, draft)
    expect(await messageText(page, text)).toBe(text)
  })

  test('Edit from the message menu with the focus elsewhere focuses the composer, the caret at the end', async ({page}) => {
    await openSelf(page)
    await resetComposer(page)
    const text = `e2e-composer-menu-edit-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    await focusThreadScroller(page)
    expect((await focusedElement(page)).testID, 'the composer still has the focus').not.toBe(T.CHAT_INPUT)

    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Edit', {exact: true}))
    await expect(editBar(page)).toBeVisible({timeout: 5_000})
    await expect
      .poll(async () => focusedElement(page), {timeout: 5_000})
      .toEqual({end: text.length, start: text.length, testID: T.CHAT_INPUT, value: text})
    // what is typed goes into the edit
    await page.keyboard.type(' changed')
    await expectComposerText(page, `${text} changed`)
    await composer.press(page, 'Escape')
    await expect(editBar(page)).toHaveCount(0, {timeout: 5_000})
  })
})

test.describe('reply', () => {
  test.afterEach(async ({page}) => {
    await resetComposer(page)
  })

  const startReply = async (page: Page) => {
    await openScratch(page)
    await resetComposer(page)
    const text = `e2e-composer-reply-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Reply', {exact: true}))
    await expect(replyPreview(page)).toBeVisible({timeout: 5_000})
    await expect(replyPreview(page)).toContainText(text)
    await expect(composerInput(page)).toBeFocused({timeout: 5_000})
  }

  test('the reply banner shows, and Escape cancels it', async ({page}) => {
    await startReply(page)
    await composer.press(page, 'Escape')
    await expect(replyPreview(page)).toHaveCount(0, {timeout: 5_000})
  })

  test('the reply banner shows, and its close button cancels it', async ({page}) => {
    await startReply(page)
    await clickUnoccluded(page.getByTestId(T.CHAT_REPLY_CANCEL))
    await expect(replyPreview(page)).toHaveCount(0, {timeout: 5_000})
  })

  test('Escape with a suggestion list open closes only the list, and keeps the previewed text', async ({page}) => {
    await startReply(page)
    await page.keyboard.type('@')
    await expect(suggestionList(page)).toBeVisible({timeout: 10_000})
    await expect.poll(async () => (await suggestionRows(page)).length, {timeout: 10_000}).toBeGreaterThan(1)
    await page.keyboard.press('ArrowDown')
    const second = firstLine((await suggestionRows(page))[1]?.text)
    await expectComposerText(page, `@${second}`)

    await page.keyboard.press('Escape')
    await expect(suggestionList(page)).toHaveCount(0, {timeout: 5_000})
    await expect(replyPreview(page)).toBeVisible()
    await expectComposerText(page, `@${second}`)

    // the next Escape is the reply's
    await page.keyboard.press('Escape')
    await expect(replyPreview(page)).toHaveCount(0, {timeout: 5_000})
    await expectComposerText(page, `@${second}`)

    // kept as the user's own text: it was saved as the draft
    await openSelf(page)
    await openScratch(page)
    await expectComposerText(page, `@${second}`)
  })
})

const firstLine = (text: string | undefined) => (text ?? '').split('\n')[0] ?? ''
const lastLine = (text: string | undefined) => (text ?? '').split('\n').at(-1) ?? ''

const selectedIndex = async (page: Page) => (await suggestionRows(page)).findIndex(r => r.selected)

// Types `text` into an empty composer in e2e-scratch and waits for a list of more than one row.
const openList = async (page: Page, text: string) => {
  await openScratch(page)
  await resetComposer(page)
  await typeInComposer(page, text)
  await expect(suggestionList(page)).toBeVisible({timeout: 10_000})
  await expect.poll(async () => (await suggestionRows(page)).length, {timeout: 10_000}).toBeGreaterThan(1)
  await expect.poll(async () => selectedIndex(page), {timeout: 5_000}).toBe(0)
}

test.describe('suggestions', () => {
  test.afterEach(async ({page}) => {
    await resetComposer(page)
    await expect(suggestionList(page)).toHaveCount(0, {timeout: 5_000})
  })

  test('@mention list: the arrows move the highlight and preview it, and Enter picks it', async ({page}) => {
    await openList(page, 'hi @')
    const rows = await suggestionRows(page)
    const [first, second] = [firstLine(rows[0]?.text), firstLine(rows[1]?.text)]

    await page.keyboard.press('ArrowDown')
    await expect.poll(async () => selectedIndex(page), {timeout: 5_000}).toBe(1)
    await expectComposerText(page, `hi @${second}`)
    await page.keyboard.press('ArrowUp')
    await expect.poll(async () => selectedIndex(page), {timeout: 5_000}).toBe(0)
    await expectComposerText(page, `hi @${first}`)

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(suggestionList(page)).toHaveCount(0, {timeout: 5_000})
    await expectComposerText(page, `hi @${second} `)
  })

  test('@mention list: Tab moves through an unfiltered list and picks from a filtered one', async ({page}) => {
    await openList(page, '@')
    await page.keyboard.press('Tab')
    await expect.poll(async () => selectedIndex(page), {timeout: 5_000}).toBe(1)
    await expect(suggestionList(page)).toBeVisible()
    await expect(composerInput(page)).toBeFocused()

    await resetComposer(page)
    await typeInComposer(page, `@${data.secondUser}`)
    await expect.poll(async () => firstLine((await suggestionRows(page))[0]?.text), {timeout: 10_000}).toBe(data.secondUser)
    await expect.poll(async () => selectedIndex(page), {timeout: 5_000}).toBe(0)
    await page.keyboard.press('Tab')
    await expect(suggestionList(page)).toHaveCount(0, {timeout: 5_000})
    await expectComposerText(page, `@${data.secondUser} `)
  })

  test('@mention list: a new filter puts the highlight back on the first row', async ({page}) => {
    await openList(page, '@')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect.poll(async () => selectedIndex(page), {timeout: 5_000}).toBe(2)
    const previewed = firstLine((await suggestionRows(page))[2]?.text)
    await expectComposerText(page, `@${previewed}`)

    // one letter off the preview is a new filter the previewed row still matches
    await page.keyboard.press('Backspace')
    await expectComposerText(page, `@${previewed.slice(0, -1)}`)
    await expect.poll(async () => (await suggestionRows(page)).map(r => firstLine(r.text)), {timeout: 10_000}).toContain(previewed)
    await expect.poll(async () => selectedIndex(page), {timeout: 5_000}).toBe(0)
  })

  test('emoji list: Enter picks the highlighted emoji', async ({page}) => {
    await openList(page, 'x :smil')
    const highlighted = (await suggestionRows(page)).find(r => r.selected)
    const name = lastLine(highlighted?.text)
    expect(name).toMatch(/^[\w+-]+$/)
    await page.keyboard.press('Enter')
    await expect(suggestionList(page)).toHaveCount(0, {timeout: 5_000})
    await expectComposerText(page, `x :${name}: `)
  })

  // The bot's commands are read from the service (the e2e team has a bot installed), never named here.
  const botCommandsFor = async () => {
    const all = await botCommands(E2E_CHANNELS.scratch)
    const bot = all[0]?.username
    const commands = all.filter(c => c.username === bot)
    test.skip(commands.length < 2, 'the e2e team needs a bot with at least two commands to paste')
    return commands
  }
  const commandMarkdown = (page: Page) => page.getByTestId(T.CHAT_COMMAND_MARKDOWN)
  // A command's help title, as drawn: its markdown (`*!bot cmd*\nWhat it does`) without the emphasis.
  const titleLines = (title: string | undefined) =>
    (title ?? '')
      .split('\n')
      .map(l => l.replace(/\*/g, '').trim())
      .filter(Boolean)
  const pasteIntoComposer = async (page: Page, text: string) => {
    await openScratch(page)
    await resetComposer(page)
    await composer.focus(page)
    await page.keyboard.insertText(text)
  }

  test('pasting a bot name lists its commands, the first highlighted', async ({page}) => {
    const commands = await botCommandsFor()
    await pasteIntoComposer(page, `!${commands[0]!.username}`)
    await expect(suggestionList(page)).toBeVisible({timeout: 10_000})
    await expect
      .poll(async () => (await suggestionRows(page)).map(r => firstLine(r.text)), {timeout: 10_000})
      .toEqual(commands.map(c => `!${c.name}`))
    expect((await suggestionRows(page)).map(r => r.selected)).toEqual(commands.map((_, i) => i === 0))
  })

  test('pasting part of a bot command highlights that command', async ({page}) => {
    const commands = await botCommandsFor()
    // not the first command, so the highlight has to move to it
    const target = commands[1]!
    const others = commands.filter(c => c !== target).map(c => c.name)
    let prefix = target.name
    for (let n = target.username.length + 2; n <= target.name.length; n++) {
      if (!others.some(o => o.startsWith(target.name.slice(0, n)))) {
        prefix = target.name.slice(0, n)
        break
      }
    }
    await pasteIntoComposer(page, `!${prefix}`)
    await expect(suggestionList(page)).toBeVisible({timeout: 10_000})
    await expect
      .poll(async () => (await suggestionRows(page)).map(r => ({command: firstLine(r.text), selected: r.selected})), {
        timeout: 10_000,
      })
      .toEqual([{command: `!${target.name}`, selected: true}])
  })

  test('pasting a whole bot command shows that command\'s help instead of the list', async ({page}) => {
    const commands = (await botCommandsFor()).filter(c => titleLines(c.extended_description?.title).length)
    test.skip(commands.length < 2, 'the bot needs two commands with help to tell them apart')
    const target = commands[1]!
    await pasteIntoComposer(page, `!${target.name}`)
    await expect(commandMarkdown(page)).toBeVisible({timeout: 10_000})
    await expect(suggestionList(page)).toHaveCount(0)
    const help = await commandMarkdown(page).innerText({timeout: 5_000})
    for (const line of titleLines(target.extended_description?.title)) {
      expect(help, `the help names ${target.name}`).toContain(line)
    }
    for (const other of commands.filter(c => c !== target)) {
      // the other commands' one-line summaries, which only their own help shows
      const summary = titleLines(other.extended_description?.title).at(-1)!
      expect(help, `the help is not ${other.name}'s`).not.toContain(summary)
    }
    // clearing the text closes the help
    await composerInput(page).fill('', {timeout: 5_000})
    await expect(commandMarkdown(page)).toHaveCount(0, {timeout: 10_000})
  })
})

test.describe('keys', () => {
  test.afterEach(async ({page}) => {
    await resetComposer(page)
  })

  const caret = async (page: Page) => composer.caret(page)

  // "ab" with the caret between the two letters
  const abWithCaretInside = async (page: Page) => {
    await openScratch(page)
    await resetComposer(page)
    await typeInComposer(page, 'ab')
    await page.keyboard.press('ArrowLeft')
    expect(await caret(page)).toEqual({end: 1, start: 1})
  }

  for (const key of ['Shift+Enter', 'Control+Enter', 'Alt+Enter', 'Meta+Enter']) {
    test(`${key} inserts a newline at the caret`, async ({page}) => {
      await abWithCaretInside(page)
      const rows = await page.getByTestId(T.CHAT_MESSAGE_LIST).locator('[data-ordinal]').count()
      await page.keyboard.press(key)
      await expectComposerText(page, 'a\nb')
      expect(await caret(page)).toEqual({end: 2, start: 2})
      // nothing was sent
      await page.waitForTimeout(500)
      expect(await page.getByTestId(T.CHAT_MESSAGE_LIST).locator('[data-ordinal]').count()).toBe(rows)
    })
  }

  for (const key of ['Control+Enter', 'Alt+Enter', 'Meta+Enter']) {
    test(`Cmd-Z undoes the newline ${key} inserted`, async ({page}) => {
      await abWithCaretInside(page)
      await page.keyboard.press(key)
      await expectComposerText(page, 'a\nb')
      await page.keyboard.press('Meta+z')
      await expectComposerText(page, 'ab')
    })
  }

  test('plain Enter sends', async ({page}) => {
    await openScratch(page)
    await resetComposer(page)
    const text = `e2e-composer-enter-${Date.now()}`
    await typeInComposer(page, text)
    await page.keyboard.press('Enter')
    await waitForRow(page, text)
    await expectComposerText(page, '')
  })

  test('an emoji from the picker goes in at the caret with one space after it', async ({page}) => {
    await openScratch(page)
    await resetComposer(page)
    await typeInComposer(page, 'hello world')
    for (const _ of 'world') await page.keyboard.press('ArrowLeft')
    expect(await caret(page)).toEqual({end: 6, start: 6})

    // the composer's own emoji button, beside the textarea
    const button = composerInput(page)
      .locator('xpath=ancestor::div[.//span[contains(@class,"icon-gen-iconfont-emoji")]][1]')
      .locator('.icon-gen-iconfont-emoji')
    await clickUnoccluded(button)
    const picker = page.getByTestId(T.CHAT_EMOJI_PICKER)
    await expect(picker).toBeVisible({timeout: 5_000})
    // the popup ignores a hide within 100ms of its show (see messageMenu): an emoji picked sooner
    // goes in but leaves the picker open
    await page.waitForTimeout(150)
    await picker.getByPlaceholder('Search', {exact: true}).fill('tada', {timeout: 5_000})
    await expect(picker.getByText('Search results', {exact: true})).toBeVisible({timeout: 5_000})
    await clickUnoccluded(picker.locator('.emoji-picker-emoji-box').filter({has: page.locator('[title="tada"]')}).first())
    await expect(picker).toHaveCount(0, {timeout: 5_000})

    await expectComposerText(page, 'hello :tada: world')
    expect(await caret(page)).toEqual({end: 13, start: 13})
  })
})

test.describe('read-only channel', () => {
  // the second account is a writer; e2e-readonly takes posts from admins only
  test.afterEach(async ({page}) => {
    if (await page.getByTestId(T.FLOATING_MENU).count()) await closeMenu(page)
    await switchAccount(page, data.smokeUser)
  })

  test('as a writer: no edit or reply, Enter sends nothing, and nothing typed becomes a draft', async ({page}) => {
    test.setTimeout(90_000)
    await switchAccount(page, data.secondUser)
    await openConversationByName(page, data.team, E2E_CHANNELS.readonly)
    const input = composerInput(page)
    await expect(input).toHaveAttribute('readonly', '', {timeout: 10_000})
    await expectComposerText(page, '')

    const rows = page.getByTestId(T.CHAT_MESSAGE_LIST).locator('[data-ordinal]')
    const last = rows.filter({hasText: /^e2e-readonly-\d{4}/}).last()
    const ordinal = Number(await last.getAttribute('data-ordinal', {timeout: 10_000}))

    // the hover bar has no Reply, and the menu no Edit or Reply
    await last.hover({timeout: 5_000})
    await expect(last.locator('.icon-gen-iconfont-ellipsis').first()).toBeVisible({timeout: 5_000})
    await expect(last.locator('.icon-gen-iconfont-reply')).toHaveCount(0)
    const menu = await messageMenu(page, ordinal)
    await expect(menu.getByText('Copy text', {exact: true})).toBeVisible()
    await expect(menu.getByText('Edit', {exact: true})).toHaveCount(0)
    await expect(menu.getByText('Reply', {exact: true})).toHaveCount(0)
    await closeMenu(page)

    const before = await rows.count()
    await input.click({timeout: 5_000})
    await page.keyboard.type('e2e-readonly-typed')
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowUp')
    await page.waitForTimeout(1_000)
    await expectComposerText(page, '')
    await expect(editBar(page)).toHaveCount(0)
    expect(await rows.count()).toBe(before)

    await openScratch(page)
    await openConversationByName(page, data.team, E2E_CHANNELS.readonly)
    await expect(composerInput(page)).toHaveAttribute('readonly', '', {timeout: 10_000})
    await expectComposerText(page, '')
  })
})

// Arrowing through a suggestion list shows each pick in the composer without it being typed.
// Leaving with one showing keeps it as the draft, and the app does not tell the conversation left
// behind that the user is typing. What the app sends is read off its dev RPC log (every call it
// makes, with its params, in the renderer console); the other account is not watched.
test.describe('leaving with a suggestion preview', () => {
  test.afterEach(async ({page}) => {
    await openScratch(page)
    await resetComposer(page)
  })

  test('the @mention preview is the draft on return, and no typing goes out for it', async ({page}) => {
    await openScratch(page)
    await resetComposer(page)
    await expect(selfRow(page)).toHaveCount(1, {timeout: 10_000})
    const rpcs = await watchOutgoingRpcs(page)
    await typeInComposer(page, '@')
    await expect(suggestionList(page)).toBeVisible({timeout: 10_000})
    await expect.poll(async () => (await suggestionRows(page)).length, {timeout: 10_000}).toBeGreaterThan(1)
    await page.keyboard.press('ArrowDown')
    const second = firstLine((await suggestionRows(page))[1]?.text)
    expect(second, 'the second row has a name').not.toBe('')
    await expectComposerText(page, `@${second}`)
    await expect(suggestionList(page)).toBeVisible()
    // past the typing throttle (1s), so the typing from before the leave has all gone out
    await page.waitForTimeout(1_500)
    const leftMark = Date.now()

    // leaves the way a user does: a click on another conversation's inbox row
    await clickUnoccluded(selfRow(page))
    await expect(composerInput(page)).toHaveAttribute('placeholder', 'Message yourself', {timeout: 10_000})
    // past the throttle again: a typing call the leave queued has gone out by now
    await page.waitForTimeout(1_500)
    const calls = await rpcs.stop()
    // the log prints params as `{conversationID: Uint8Array(32), typing: true, sessionID: 5}`
    const typing = calls.filter(c => c.method === 'chat.1.local.updateTyping')
    const typingOn = typing.filter(c => /\btyping: true\b/.test(c.params))
    // the '@' itself was typing, and the log shows it: the read below can see a typing call
    expect(typingOn.filter(c => c.at < leftMark).length, `typing calls: ${JSON.stringify(typing)}`).toBeGreaterThan(0)
    const drafts = calls.filter(c => c.method === 'chat.1.local.updateUnsentText' && c.at >= leftMark).map(c => c.params)
    expect(
      drafts.some(p => p.includes(`text: @${second},`)),
      `draft saves after leaving: ${JSON.stringify(drafts)}`
    ).toBe(true)
    // the click blurs the composer before the conversation goes, which closes the list first
    expect(typingOn.filter(c => c.at >= leftMark), `typing calls after leaving: ${JSON.stringify(typing)}`).toEqual([])

    await openScratch(page)
    await expectComposerText(page, `@${second}`)
    await expect(suggestionList(page)).toHaveCount(0)
  })
})

// The channel turns read-only for the second account (a writer) while it edits: the owner, the app
// attached to Metro, raises the channel's minimum writer role. Ending the edit then empties the
// composer and leaves the draft set aside for the edit as it was; it loads again once the account
// can post. The owner clearing the role altogether makes the channel writable again as it shows.
test.describe('read-only mid-edit', () => {
  const prefix = 'e2e-roedit'

  test.beforeAll(async () => {
    test.setTimeout(120_000)
    if ((await cliWhoami()) !== data.smokeUser) throw new Error('the desktop app and CLI must start as the smoke user')
    await requireAttachedAppAsEither(data.secondUser, data.smokeUser)
    await deleteThrowawayChannels(prefix)
  })

  test.afterEach(async ({page}) => {
    test.setTimeout(120_000)
    await switchAccount(page, data.smokeUser)
    await switchAttachedApp(data.secondUser)
    await deleteThrowawayChannels(prefix)
  })

  test('Escape ends the edit, empties the composer and leaves the draft, which comes back once it can post', async ({page}) => {
    test.setTimeout(180_000)
    await switchAttachedApp(data.smokeUser)
    const owner = requireAttachedApp(await findChannelOwner(data.smokeUser), "the owner's app")
    const {convID, topicName} = await createThrowawayChannel(prefix)

    await switchAccount(page, data.secondUser)
    // from its inbox row: inbox search can lag behind a channel made moments earlier
    const row = page.locator('.inbox-hover-container').getByText(topicName, {exact: true})
    await expect(row).toBeVisible({timeout: 20_000})
    await clickUnoccluded(row)
    await expect(threadHeaderTitle(page)).toHaveText(`${data.team}#${topicName}`, {timeout: 10_000})
    const input = composerInput(page)
    await expect(input).not.toHaveAttribute('readonly', '', {timeout: 10_000})

    const text = `e2e-roedit-message-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    const draft = `e2e-roedit-draft-${Date.now()}`
    await typeInComposer(page, draft)
    // past the draft save's throttle, so the draft is saved before the edit sets it aside
    await page.waitForTimeout(500)

    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Edit', {exact: true}))
    await expect(editBar(page)).toBeVisible({timeout: 5_000})
    await expectComposerText(page, text)
    await composer.focus(page)
    await page.keyboard.press('End')
    await page.keyboard.type(' changed')
    await expectComposerText(page, `${text} changed`)

    await owner.setMinWriterRole(convID, 'admin')
    await expect(input).toHaveAttribute('readonly', '', {timeout: 20_000})

    await composer.press(page, 'Escape')
    await expect(editBar(page)).toHaveCount(0, {timeout: 5_000})
    await expectComposerText(page, '')
    expect(await messageText(page, text)).toBe(text)

    await owner.setMinWriterRole(convID, 'writer')
    await expect(input).not.toHaveAttribute('readonly', '', {timeout: 20_000})
    await expectComposerText(page, draft)
    expect(await messageText(page, text)).toBe(text)
  })

  test('the owner clearing the minimum writer role makes the composer writable again, without a reopen', async ({page}) => {
    test.setTimeout(180_000)
    await switchAttachedApp(data.smokeUser)
    const owner = requireAttachedApp(await findChannelOwner(data.smokeUser), "the owner's app")
    const {convID, topicName} = await createThrowawayChannel(prefix)

    await switchAccount(page, data.secondUser)
    const row = page.locator('.inbox-hover-container').getByText(topicName, {exact: true})
    await expect(row).toBeVisible({timeout: 20_000})
    await clickUnoccluded(row)
    await expect(threadHeaderTitle(page)).toHaveText(`${data.team}#${topicName}`, {timeout: 10_000})
    const input = composerInput(page)
    await expect(input).not.toHaveAttribute('readonly', '', {timeout: 10_000})

    await owner.setMinWriterRole(convID, 'admin')
    await expect(input).toHaveAttribute('readonly', '', {timeout: 20_000})
    await owner.setMinWriterRole(convID, 'none')
    await expect(input).not.toHaveAttribute('readonly', '', {timeout: 20_000})
    await expect(threadHeaderTitle(page)).toHaveText(`${data.team}#${topicName}`)

    const text = `e2e-roclear-message-${Date.now()}`
    await sendMessage(page, text)
    expect(await messageText(page, text)).toBe(text)
  })
})
