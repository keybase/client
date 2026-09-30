// What the desktop thread shows as its data changes, read off the DOM: a delete shows deleting (through
// thread reloads too) and then takes the row away, reactions come and go, an attachment collapses
// and expands, mark unread draws the orange line and marks the inbox row (and none on a first
// message), reply privately opens the direct conversation quoting the message, incoming messages
// reach the thread and the inbox, all of it keeps working across an account switch, and the thread
// left behind by one sends nothing for the next account.
import type {ConsoleMessage, Page} from '@playwright/test'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {
  clickUnoccluded,
  collectConsoleErrors,
  composer,
  composerInput,
  endTolerancePx,
  focusThreadScroller,
  inboxRow,
  messageMenu,
  openConversationByName,
  openDirectConversation,
  openSelfConversation,
  rowByOrdinal,
  heldWaitingKeys,
  sendMessage,
  startAccountSwitch,
  startStaleReloads,
  stopStaleReloads,
  switchAccount,
  threadHeaderTitle,
  waitForRow,
  waitForScrollStable,
  watchOutgoingRpcs,
  watchSelection,
} from '@/tests/e2e/electron/helpers/chat'
import {E2E_CHANNELS, attachFromCli, ensureChatData, type ChatData} from '@/tests/e2e/shared/chat-data'
import {findIncomingSender, type IncomingSender} from '@/tests/e2e/shared/incoming-sender'
import {navigateToChat} from '@/tests/e2e/electron/helpers/navigate'
import * as T from '@/tests/e2e/shared/test-ids'

let data: ChatData
let sender: IncomingSender

test.beforeAll(async () => {
  test.setTimeout(20 * 60_000) // a first run seeds; later runs only check
  data = await ensureChatData()
  sender = await findIncomingSender(data.secondUser)
})

const requireSender = () => {
  test.skip(!sender.ok, sender.ok ? '' : `second-account sender unavailable: ${sender.reason}`)
  if (!sender.ok) throw new Error('unreachable')
  return sender
}

const openScratch = async (page: Page) => openConversationByName(page, data.team, E2E_CHANNELS.scratch)
const openSelf = async (page: Page) => openSelfConversation(page, data.smokeUser)

const threadRows = (page: Page) => page.getByTestId(T.CHAT_MESSAGE_LIST).locator('[data-ordinal]')
const rowWithText = (page: Page, text: string) => threadRows(page).filter({hasText: text})

test.describe('delete', () => {
  // What the row looks like at each change, from before the delete is chosen until it is gone: the
  // row with its send indicator (a row of yours sent this session shows one while it is being
  // deleted), the row alone, or no row.
  type Phase = 'gone' | 'row' | 'row+indicator'

  const watchRow = async (page: Page, ordinal: number) =>
    page.evaluate(
      ([testID, o]) => {
        type El = {querySelector: (s: string) => El | null}
        const g = globalThis as unknown as {
          __e2eRowPhases?: Array<string>
          __e2eRowObserver?: {disconnect: () => void}
          MutationObserver: new (cb: () => void) => {disconnect: () => void; observe: (n: unknown, o: object) => void}
          document: El & {body: unknown}
        }
        const phases: Array<string> = []
        const read = () => {
          const row = g.document.querySelector(`[data-testid="${testID}"] [data-ordinal="${o}"]`)
          const phase = !row ? 'gone' : row.querySelector('.sendingStatus') ? 'row+indicator' : 'row'
          if (phases.at(-1) !== phase) {
            phases.push(phase)
            // in the console's order with the RPC log, so a flow can tell what arrived in each phase
            console.log(`e2e-row-phase ${phase}`)
          }
        }
        read()
        const observer = new g.MutationObserver(read)
        observer.observe(g.document.body, {attributes: true, childList: true, subtree: true})
        g.__e2eRowPhases = phases
        g.__e2eRowObserver = observer
      },
      [T.CHAT_MESSAGE_LIST, ordinal] as const
    )

  const rowPhases = async (page: Page) =>
    page.evaluate(() => {
      const g = globalThis as unknown as {__e2eRowPhases?: Array<string>; __e2eRowObserver?: {disconnect: () => void}}
      g.__e2eRowObserver?.disconnect()
      return (g.__e2eRowPhases ?? []) as Array<Phase>
    })

  test('deleting a message shows it deleting, then the row goes', async ({page}) => {
    await openScratch(page)
    const text = `e2e-data-delete-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    // the send indicator hides a moment after the send lands
    await expect(rowByOrdinal(page, ordinal).locator('.sendingStatus')).toHaveCount(0, {timeout: 10_000})

    await watchRow(page, ordinal)
    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Delete', {exact: true}))
    await expect(rowByOrdinal(page, ordinal)).toHaveCount(0, {timeout: 10_000})
    expect(await rowPhases(page)).toEqual(['row', 'row+indicator', 'gone'])
    await expect(rowWithText(page, text)).toHaveCount(0)
  })

  // A thread load while the delete waits to go out still carries the row unchanged (the service
  // never puts a queued delete in a load). Offline the wait is long; here the thread is told it is
  // stale every 100ms from the moment Delete is chosen, so reloads land before the delete does.
  test('a delete keeps showing deleting through thread reloads until it lands', async ({page}) => {
    await openScratch(page)
    const text = `e2e-data-delete-reload-${Date.now()}`
    const ordinal = await sendMessage(page, text)
    await expect(rowByOrdinal(page, ordinal).locator('.sendingStatus')).toHaveCount(0, {timeout: 10_000})

    await watchRow(page, ordinal)
    const menu = await messageMenu(page, ordinal)
    // the thread throttles its loads to one per 500ms, so the first reload must not follow another
    await page.waitForTimeout(600)
    // what the thread heard, in order: the row's phases and each thread pass the service sent
    const heard: Array<string> = []
    const onConsole = (m: ConsoleMessage) => {
      const text = m.text()
      const phase = /e2e-row-phase (\S+)/.exec(text)?.[1]
      if (phase) heard.push(phase)
      else if (/IN >>.*chat\.1\.chatUi\.chatThread(Cached|Full)/.test(text.replace(/%[cs]/g, ' '))) heard.push('pass')
    }
    page.on('console', onConsole)
    let reloads: number | undefined
    try {
      await startStaleReloads(page, data.convIDs[E2E_CHANNELS.scratch], 100, menu.getByText('Delete', {exact: true}))
      await expect(rowByOrdinal(page, ordinal)).toHaveCount(0, {timeout: 15_000})
    } finally {
      reloads = await stopStaleReloads(page)
      page.off('console', onConsole)
    }
    const deleting = heard.slice(heard.indexOf('row+indicator') + 1, heard.indexOf('gone'))
    const passes = deleting.filter(h => h === 'pass').length
    console.log(`delete through reloads: ${reloads} stale notifications; heard ${heard.join(' ')}`)
    expect(passes, `no thread load landed while the row showed deleting: ${heard.join(' ')}`).toBeGreaterThan(0)
    expect(await rowPhases(page)).toEqual(['row', 'row+indicator', 'gone'])
  })
})

test.describe('reactions', () => {
  const reaction = (page: Page, text: string, emoji: string) =>
    rowWithText(page, text).locator('.react-button').filter({has: page.locator(`[title="${emoji}"]`)})

  // Reacts to the message with :tada: from its hover bar, and waits for the reaction.
  const react = async (page: Page, text: string) => {
    const row = rowWithText(page, text)
    await row.hover({timeout: 5_000})
    await clickUnoccluded(row.locator('.icon-gen-iconfont-reacji').first())
    const picker = page.getByTestId(T.CHAT_EMOJI_PICKER)
    await expect(picker).toBeVisible({timeout: 5_000})
    // the popup ignores a hide within 100ms of its show (see messageMenu)
    await page.waitForTimeout(150)
    await picker.getByPlaceholder('Search', {exact: true}).fill('tada', {timeout: 5_000})
    await expect(picker.getByText('Search results', {exact: true})).toBeVisible({timeout: 5_000})
    await clickUnoccluded(picker.locator('.emoji-picker-emoji-box').filter({has: page.locator('[title="tada"]')}).first())
    await expect(picker).toHaveCount(0, {timeout: 5_000})
    await expect(reaction(page, text, 'tada')).toHaveCount(1, {timeout: 10_000})
  }

  // Opens e2e-scratch fresh (switched away from first, so the list mounts and loads anew) and sends
  // a message there.
  const sendFresh = async (page: Page) => {
    await openConversationByName(page, data.team, E2E_CHANNELS.media)
    await openScratch(page)
    const text = `e2e-data-reaction-${Date.now()}`
    await sendMessage(page, text)
    return text
  }

  // a thread left short of its end would keep the reaction button under the composer
  const removeReaction = async (page: Page, text: string) => {
    await focusThreadScroller(page)
    await page.keyboard.press('End')
    await waitForScrollStable(page)
    await clickUnoccluded(reaction(page, text, 'tada'))
    await expect(reaction(page, text, 'tada')).toHaveCount(0, {timeout: 10_000})
  }

  test('a reaction adds from the hover bar and removes from its button', async ({page}) => {
    const text = await sendFresh(page)
    await react(page, text)
    const button = reaction(page, text, 'tada')
    // the count is drawn from a data attribute, not text
    await expect(button.locator('.text_BodyTinyBold')).toHaveAttribute('data-virtual-text', '1')
    // yours: drawn as the active one
    await expect(button).toHaveClass(/noShadow/)
    await removeReaction(page, text)
  })

  test('a reaction on the newest message keeps the thread at its end', async ({page}) => {
    const text = await sendFresh(page)
    const before = await waitForScrollStable(page)
    await react(page, text)
    try {
      const after = await waitForScrollStable(page)
      expect(
        after.distanceFromEnd,
        `distance from the end after the reaction (before it: ${before.distanceFromEnd})`
      ).toBeLessThanOrEqual(endTolerancePx)
    } finally {
      await removeReaction(page, text)
    }
  })
})

test.describe('attachments', () => {
  const collapseIcon = (page: Page, ordinal: number, collapsed: boolean) =>
    rowByOrdinal(page, ordinal).locator(collapsed ? '.icon-gen-iconfont-caret-right' : '.icon-gen-iconfont-caret-down')

  test('an image just sent collapses and expands', async ({page}) => {
    await openScratch(page)
    const title = `e2e-data-image-${Date.now()}`
    await attachFromCli(E2E_CHANNELS.scratch, title)
    const ordinal = await waitForRow(page, title, 30_000)
    const row = rowByOrdinal(page, ordinal)
    await expect(row.getByTestId(T.CHAT_ATTACHMENT_IMAGE)).toHaveCount(1, {timeout: 15_000})
    // The image's row grows as it loads, at the end of the thread, which can leave the thread short
    // of its end with the row's header under the composer (the growth bug the reaction flow
    // records). Bring the row into view as a reader would.
    await focusThreadScroller(page)
    await page.keyboard.press('End')
    await waitForScrollStable(page)

    try {
      await clickUnoccluded(collapseIcon(page, ordinal, false))
      await expect(collapseIcon(page, ordinal, true)).toHaveCount(1, {timeout: 10_000})
      await expect(row.getByTestId(T.CHAT_ATTACHMENT_IMAGE)).toHaveCount(0)
      await expect(row).toContainText('Collapsed')
      await expect(row).not.toContainText(title)
      // The collapsed row is shorter, so the thread re-pins its end and the row moves down (about
      // 145px) just after it collapses; a click aimed before that lands where the icon was.
      await waitForScrollStable(page)

      await clickUnoccluded(collapseIcon(page, ordinal, true))
      await expect(collapseIcon(page, ordinal, false)).toHaveCount(1, {timeout: 10_000})
      await expect(row.getByTestId(T.CHAT_ATTACHMENT_IMAGE)).toHaveCount(1, {timeout: 10_000})
      await expect(row).toContainText(title)
    } finally {
      // collapsing is saved on the server; leave it expanded
      if (await collapseIcon(page, ordinal, true).count()) await clickUnoccluded(collapseIcon(page, ordinal, true))
    }
  })
})

test.describe('mark unread', () => {
  // The rows whose top carries the orange line (a 1px orange rule the separator draws above them).
  const orangeLineRows = async (page: Page) =>
    page.evaluate(testID => {
      type El = {closest: (s: string) => El | null; innerText: string; style: {backgroundColor: string; height: string}}
      const g = globalThis as unknown as {document: {querySelectorAll: (s: string) => ArrayLike<El>}}
      return Array.from(g.document.querySelectorAll(`[data-testid="${testID}"] div`))
        .filter(d => d.style.backgroundColor.includes('orange') && d.style.height === '1px')
        .map(d => d.closest('[data-ordinal]')?.innerText.trim() ?? '')
    }, T.CHAT_MESSAGE_LIST)

  // The self conversation's name in its inbox row: bold while it has unread messages.
  const selfRowName = (page: Page) => inboxRow(page, data.smokeUser).locator(`[title="${data.smokeUser}"]`)

  test('mark unread draws the orange line above the message and marks the inbox row unread', async ({page}) => {
    await openSelf(page)
    const first = `e2e-data-unread-a-${Date.now()}`
    const firstOrdinal = await sendMessage(page, first)
    const second = `e2e-data-unread-b-${Date.now()}`
    await sendMessage(page, second)
    await expect.poll(async () => orangeLineRows(page), {timeout: 5_000}).toEqual([])
    await waitForScrollStable(page)

    const menu = await messageMenu(page, firstOrdinal)
    await clickUnoccluded(menu.getByText('Mark as unread', {exact: true}))
    await expect(page.getByTestId(T.FLOATING_MENU)).toHaveCount(0, {timeout: 5_000})
    await expect.poll(async () => orangeLineRows(page), {timeout: 5_000}).toEqual([first])

    await openScratch(page)
    await expect(selfRowName(page)).toHaveClass(/text_BodyBold/, {timeout: 10_000})

    // opening it again reads it: the line stays where it was for this visit, and the row is read
    await openSelf(page)
    await expect.poll(async () => orangeLineRows(page), {timeout: 10_000}).toEqual([first])
    await openScratch(page)
    await expect(selfRowName(page)).toHaveClass(/text_BodySemibold/, {timeout: 10_000})
  })

  // Nothing is older than a conversation's first message, so marking it unread has no read position
  // to move to: nothing is marked, and no line is drawn for a mark that never happened.
  test('mark unread on the first message of a conversation draws no orange line', async ({page}) => {
    test.setTimeout(90_000)
    await openDirectConversation(page, data.secondUser)
    // Home until the list rests at its top with nothing more coming in above; the composer takes the
    // focus as the conversation opens, so the scroller is given it back each time
    let oldest = -1
    await expect(async () => {
      await focusThreadScroller(page)
      await page.keyboard.press('Home')
      const g = await waitForScrollStable(page, 15_000)
      await page.waitForTimeout(1_000)
      const again = await waitForScrollStable(page, 15_000)
      const first = again.rows[0]?.ordinal ?? -1
      const settled = g.rows[0]?.ordinal === first && again.scrollTop === 0 && first === oldest
      oldest = first
      expect(settled, `the list is still loading older rows (oldest ${first}, scrollTop ${again.scrollTop})`).toBe(true)
    }).toPass({timeout: 60_000})

    const logs: Array<string> = []
    const onConsole = (m: ConsoleMessage) => {
      if (m.text().includes('marking unread messages')) logs.push(m.text())
    }
    page.on('console', onConsole)
    try {
      const menu = await messageMenu(page, oldest)
      await clickUnoccluded(menu.getByText('Mark as unread', {exact: true}))
      await expect(page.getByTestId(T.FLOATING_MENU)).toHaveCount(0, {timeout: 5_000})
      await expect.poll(() => logs.length, {timeout: 10_000}).toBeGreaterThan(0)
    } finally {
      page.off('console', onConsole)
    }
    // the app's own account of the mark: it found nothing older than the line
    expect(logs.join('\n')).toContain('nothing older than')
    // a line would be drawn within a frame of the answer; give it well past that
    for (const until = Date.now() + 2_000; Date.now() < until; await page.waitForTimeout(100)) {
      expect(await orangeLineRows(page), 'the orange line after marking the first message unread').toEqual([])
    }
    await openScratch(page)
    await expect(inboxRow(page, data.secondUser).locator(`[title="${data.secondUser}"]`)).toHaveClass(/text_BodySemibold/, {
      timeout: 10_000,
    })
  })
})

test.describe('reply privately', () => {
  test.afterEach(async ({page}) => {
    // the quote was injected into the direct conversation's composer, which saved it as its draft
    if ((await threadHeaderTitle(page).innerText({timeout: 5_000}).catch(() => '')) === data.secondUser) {
      await composerInput(page).fill('', {timeout: 5_000})
      await expect.poll(async () => composer.getText(page), {timeout: 5_000}).toBe('')
    }
  })

  test("reply privately opens the direct conversation with the message quoted in the composer", async ({page}) => {
    const s = requireSender()
    await openScratch(page)
    const text = `e2e-data-private-${Date.now()}`
    await s.send(data.convIDs[E2E_CHANNELS.scratch], data.team, text)
    const ordinal = await waitForRow(page, text, 20_000)

    const menu = await messageMenu(page, ordinal)
    await clickUnoccluded(menu.getByText('Reply privately', {exact: true}))
    await expect(threadHeaderTitle(page)).toHaveText(data.secondUser, {timeout: 10_000})
    await expect.poll(async () => composer.getText(page), {timeout: 10_000}).toBe(`> ${text}\n`)
  })
})

test.describe('incoming', () => {
  test('an incoming message reaches the open thread and the inbox snippet', async ({page}) => {
    const s = requireSender()
    await openDirectConversation(page, data.secondUser)
    const text = `e2e-data-incoming-${Date.now()}`
    await s.send(data.direct.convID, data.direct.tlfName, text)
    await waitForRow(page, text, 20_000)
    await expect(rowWithText(page, text)).toHaveCount(1)
    await expect(inboxRow(page, data.secondUser)).toContainText(text, {timeout: 10_000})
  })
})

test.describe('account switch', () => {
  // Console errors these flows see that are not the thread's doing across a switch:
  // - A switch cancels the RPCs in flight, and the account menu's own refresh of the account list
  //   is one of them; its cancellation is logged as an error on every switch (code 237, "Received
  //   RPC cancel for session"). It comes from opening the menu.
  // - "getUsernameToShow: message with no author" (separator-utils), logged in bursts as a thread
  //   loads. It shows up without any switch too (the composer flows' self conversation), and could
  //   not be pinned to a step; it is reported separately rather than failed here.
  const notFromTheSwitch = [/refreshAccounts|ignorePromise error/, /getUsernameToShow: message with no author/]


  test.afterEach(async ({page}) => {
    await switchAccount(page, data.smokeUser)
  })

  test('a thread opened after switching accounts and back gets new messages and typing for the account signed in', async ({page}) => {
    test.setTimeout(120_000)
    const s = requireSender()
    const errors = collectConsoleErrors(page, notFromTheSwitch)
    await openScratch(page)

    // as the second account: the thread builds for it and hears a message sent from its other device
    await switchAccount(page, data.secondUser)
    await openScratch(page)
    const whileSecond = `e2e-data-switch-second-${Date.now()}`
    await s.send(data.convIDs[E2E_CHANNELS.scratch], data.team, whileSecond)
    await waitForRow(page, whileSecond, 20_000)

    // back as the smoke user: the thread builds again, with that message in it once
    await switchAccount(page, data.smokeUser)
    await openScratch(page)
    await waitForRow(page, whileSecond, 20_000)

    const incoming = `e2e-data-switch-back-${Date.now()}`
    await s.send(data.convIDs[E2E_CHANNELS.scratch], data.team, incoming)
    await waitForRow(page, incoming, 20_000)
    await expect(rowWithText(page, incoming)).toHaveCount(1)

    const typing = page.getByText(`${data.secondUser} is typing`)
    await s.typing(data.convIDs[E2E_CHANNELS.scratch], true)
    await expect(typing).toBeVisible({timeout: 15_000})
    await s.typing(data.convIDs[E2E_CHANNELS.scratch], false)
    await expect(typing).toHaveCount(0, {timeout: 15_000})

    expect(errors.stop(), 'console errors across the switches').toEqual([])
  })

  // The account's own pick of a conversation lands up to a second after a switch, with the service
  // still naming the previous account's selection; the conversation the user opened stays anyway.
  test('a conversation opened right after an account switch stays open', async ({page}) => {
    test.setTimeout(90_000)
    await switchAccount(page, data.secondUser)
    await openScratch(page)
    const expected = `${data.team}#${E2E_CHANNELS.scratch} | #${E2E_CHANNELS.scratch}`
    const seen = await watchSelection(page, 1_500)
    expect(seen, 'the thread header and selected inbox row after opening').toEqual([expected])
  })

  // The thread open when the account changes belongs to the account that left. Typing in its
  // composer right through the switch sends nothing for the next account (no typing, no draft
  // save, no post), and nothing on screen is left waiting on a call it never made. The switch goes
  // through the app's own switch, so the composer keeps the focus the switcher's menu would take.
  test('typing through an account switch sends nothing for the next account and leaves nothing waiting', async ({page}) => {
    test.setTimeout(90_000)
    await openScratch(page)
    const token = `e2eswitchdraft${Date.now()}`
    await composer.type(page, token)
    // the draft saves for the account that typed it
    await page.waitForTimeout(1_000)

    const rpcs = await watchOutgoingRpcs(page)
    const typing = page.keyboard.type('x'.repeat(40), {delay: 40})
    await page.waitForTimeout(300)
    await startAccountSwitch(page, data.secondUser)
    await typing
    await expect(page.locator('.username').first()).toHaveText(new RegExp(`^(Hi )?${data.secondUser}!?$`), {timeout: 30_000})
    // outlast the composer's 200ms draft save and 1s typing throttle, and a load or two
    await page.waitForTimeout(5_000)
    const calls = await rpcs.stop()
    const after = calls.filter(c => c.afterAccountChange)
    const composerCalls = /^chat\.1\.local\.(updateUnsentText|updateTyping|post\w*)$/
    const before = calls.filter(c => !c.afterAccountChange && composerCalls.test(c.method))
    console.log(`the composer's calls in the 300ms before the account changed: ${before.map(c => c.method).join(', ')}`)
    // the composer was saving drafts as the keys came, and the keys went on through the switch
    expect(before.length, 'the composer sent nothing while typing before the switch').toBeGreaterThan(0)
    expect(after.length, 'no RPC seen after the account changed').toBeGreaterThan(0)
    expect(
      after.filter(c => composerCalls.test(c.method)).map(c => `${c.method} ${c.params.slice(0, 120)}`),
      "the old composer's calls after the account changed"
    ).toEqual([])
    expect(await heldWaitingKeys(page), 'waiting keys still held 5s after the switch').toEqual([])

    // and the next account's own draft there is not what the other account typed
    await navigateToChat(page)
    await openScratch(page)
    await expect.poll(async () => composer.getText(page), {timeout: 5_000}).not.toContain(token)
  })
})
