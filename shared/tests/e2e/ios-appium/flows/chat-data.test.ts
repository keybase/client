// What the phone thread shows as its data changes, read off the thread store and the screen: a
// delete shows deleting (through thread reloads too) and then takes the row away, reactions come and
// go, mark unread sets the orange line and the inbox's unread count (and none on a first message),
// reply privately opens the direct conversation quoting the message, incoming messages reach the
// thread and the inbox, all of it keeps working across an account switch, and the thread left behind
// by one sends nothing for the next account.
import {
  E2E_CHANNELS,
  createThrowawayChannel,
  ensureChatData,
  leaveChannelFromCli,
  sendDirectFromCli,
  sendFromCli,
  type ChatData,
} from '../../shared/chat-data'
import {
  check,
  chooseDeleteBehindAReload,
  chooseMenuItem,
  clearComposer,
  closeMessageMenu,
  deleteChannelAsApp,
  deletePhase,
  dragThread,
  expectAtEnd,
  heldWaitingKeys,
  hideKeyboard,
  markAccountChange,
  openConversation,
  openMessageMenu,
  ordinalsWithText,
  orangeLineOrdinals,
  outgoingRpcs,
  readThread,
  rowElement,
  rowPhasesAndPasses,
  rowText,
  sendMessage,
  signedInAs,
  staleNotificationsSent,
  startAppAccountSwitch,
  storedMessage,
  switchAppAccount,
  typeInComposer,
  unreadCount,
  visibleConversation,
  waitForComposerText,
  waitForRow,
  waitForThreadStable,
  watchDeleteThroughReloads,
  type DeletePhase,
} from '../helpers/chat'
import {jsEval, metroClientLogSince, metroLogMark, openUrl, waitFor} from '../helpers/lifecycle'
import {el} from '../helpers/elements'
import {escapeToTabs, navigateToChat} from '../helpers/navigate'
import * as T from '../../shared/test-ids'

let data: ChatData
before(async () => {
  data = await ensureChatData()
})

const openScratch = async () => openConversation(data.convIDs[E2E_CHANNELS.scratch])
const openDirect = async () => openConversation(data.direct.convID)

describe('chat data: delete', () => {
  it('deleting a message shows it deleting, then the row goes', async () => {
    await openScratch()
    const text = `e2e-ios-data-delete-${Date.now()}`
    const ordinal = await sendMessage(text)
    await hideKeyboard()
    await openMessageMenu(text)

    // every phase the row goes through, from before the delete is chosen until a while after it is gone
    const phases: Array<DeletePhase> = []
    let watching = true
    const watcher = (async () => {
      while (watching) {
        const p = await deletePhase(ordinal)
        if (phases.at(-1) !== p) phases.push(p)
      }
    })()
    try {
      await chooseMenuItem('Delete for everyone')
      await waitFor('the row to go', () => (phases.at(-1) === 'gone' ? true : undefined), {interval: 100, timeout: 10_000})
      await browser.pause(1_000)
    } finally {
      watching = false
      await watcher
    }
    check(JSON.stringify(phases) === JSON.stringify(['row', 'row+deleting', 'gone']), `the row went ${phases.join(' -> ')}`)
    check(!(await ordinalsWithText(text)).length, 'the deleted message is back in the thread')
  })
})

// A thread load while the delete waits to go out still carries the row unchanged (the service never
// puts a queued delete in a load). Offline the wait is long; here the thread is told it is stale
// right ahead of the delete and every 100ms after while it is in flight (see
// chooseDeleteBehindAReload and watchDeleteThroughReloads), so reloads come back before the delete
// lands. Whether one did is timing: an attempt in which none did proves nothing and is made again.
describe('chat data: delete through reloads', () => {
  it('a delete keeps showing deleting through thread reloads until it lands', async () => {
    await openScratch()
    const attempts: Array<string> = []
    for (let attempt = 1; attempt <= 4; attempt++) {
      const text = `e2e-ios-data-delete-reload-${Date.now()}`
      const ordinal = await sendMessage(text)
      await hideKeyboard()
      await openMessageMenu(text)
      // the thread throttles its loads to one per 500ms, so the first reload must not follow another
      await browser.pause(600)
      const mark = metroLogMark()
      await watchDeleteThroughReloads(ordinal)
      await chooseDeleteBehindAReload()
      await waitFor('the row to go', async () => ((await deletePhase(ordinal)) === 'gone' ? true : undefined), {
        interval: 100,
        timeout: 15_000,
      })
      await closeMessageMenu()
      const stale = await staleNotificationsSent()
      const heard = await waitFor(
        "the row's phases in Metro's log",
        () => {
          const h = rowPhasesAndPasses(metroClientLogSince(mark))
          return h.includes('gone') ? h : undefined
        },
        {timeout: 10_000}
      )
      // the delete can start before the watcher's first look, so the row may be first seen deleting
      const phases = heard.filter(h => h !== 'pass')
      const deleting = heard.slice(heard.indexOf('row+deleting') + 1, heard.indexOf('gone'))
      attempts.push(`${stale} stale notifications; heard ${heard.join(' ')}`)
      check(
        JSON.stringify(phases.slice(phases.indexOf('row+deleting'))) === JSON.stringify(['row+deleting', 'gone']),
        `the row went ${phases.join(' -> ')}`
      )
      if (deleting.includes('pass')) {
        console.log(`delete through reloads: ${attempts.join('; ')}`)
        return
      }
    }
    throw new Error(`no thread load landed while a row showed deleting in 4 attempts: ${attempts.join('; ')}`)
  })
})

describe('chat data: reactions', () => {
  // Reacts with a thumbs-up from the message's menu, where the quick reactions sit on top. The row
  // of quick reactions is one element whose label lists them; the thumbs-up is its first.
  const toggleThumbsUp = async (text: string) => {
    await hideKeyboard()
    await openMessageMenu(text)
    // thumbs-up and its emoji-presentation selector, as the label spells it
    const quick = browser.$(`-ios predicate string:type == "XCUIElementTypeOther" AND label BEGINSWITH "\u{1F44D}\u{FE0F}" AND visible == 1`)
    await quick.waitForExist({timeout: 5_000})
    const {x, y} = await quick.getLocation()
    const {height} = await quick.getSize()
    await browser.execute('mobile: tap', {x: Math.round(x + 36), y: Math.round(y + height / 2)})
    await quick.waitForExist({reverse: true, timeout: 5_000})
  }
  const thumbsUpFromMe = async (ordinal: number) => {
    const m = await storedMessage(ordinal)
    return !!m?.reactions.some(r => r.emoji === ':+1:' && r.users.includes(data.smokeUser))
  }

  it('a reaction adds from the message menu and removes the same way', async () => {
    await openScratch()
    const text = `e2e-ios-data-reaction-${Date.now()}`
    const ordinal = await sendMessage(text)
    await toggleThumbsUp(text)
    await waitFor('the reaction', async () => ((await thumbsUpFromMe(ordinal)) ? true : undefined), {timeout: 10_000})
    await toggleThumbsUp(text)
    await waitFor('the reaction to go', async () => ((await thumbsUpFromMe(ordinal)) ? undefined : true), {timeout: 10_000})
  })

  it('a reaction on the newest message keeps the thread at its end', async () => {
    await openScratch()
    const text = `e2e-ios-data-reaction-end-${Date.now()}`
    const ordinal = await sendMessage(text)
    await hideKeyboard()
    await expectAtEnd()
    await toggleThumbsUp(text)
    try {
      await waitFor('the reaction', async () => ((await thumbsUpFromMe(ordinal)) ? true : undefined), {timeout: 10_000})
      await expectAtEnd('after the reaction, the thread')
    } finally {
      await toggleThumbsUp(text)
      await waitFor('the reaction to go', async () => ((await thumbsUpFromMe(ordinal)) ? undefined : true), {
        timeout: 10_000,
      })
    }
  })
})

describe('chat data: mark unread', () => {
  it('mark unread sets the orange line above the message and the conversation unread', async () => {
    await openDirect()
    const first = `e2e-ios-data-unread-a-${Date.now()}`
    const firstOrdinal = await sendMessage(first)
    await sendMessage(`e2e-ios-data-unread-b-${Date.now()}`)
    await hideKeyboard()

    await openMessageMenu(first)
    await chooseMenuItem('Mark as unread')
    await waitFor('the orange line above the message', async () => {
      const lines = await orangeLineOrdinals()
      return lines.length === 1 && lines[0] === firstOrdinal ? true : undefined
    })

    await escapeToTabs()
    await navigateToChat()
    await waitFor('the conversation to count unread', async () => ((await unreadCount(data.direct.convID)) > 0 ? true : undefined), {
      timeout: 10_000,
    })

    // opening it again reads it; the line stays where it was for this visit
    await openDirect()
    await waitFor('the orange line again', async () => {
      const lines = await orangeLineOrdinals()
      return lines.length === 1 ? true : undefined
    })
    await waitFor('the conversation to be read', async () => ((await unreadCount(data.direct.convID)) === 0 ? true : undefined), {
      timeout: 10_000,
    })
  })
})

// Nothing is older than a conversation's first message, so marking it unread has no read position
// to move to: nothing is marked, and no line is drawn for a mark that never happened.
describe('chat data: mark unread on the first message', () => {
  it('mark unread on the first message of a conversation draws no orange line', async () => {
    await openDirect()
    // drag to the top until nothing older is left to load and the oldest row is in view
    const top = await waitFor(
      'the oldest message in view',
      async () => {
        const t = await waitForThreadStable()
        if (!t.moreToLoadBack && t.rows[0]?.ordinal === t.ordinals[0] && t.rows[0]!.top >= t.listTop - 1) return t
        await dragThread(600)
        return undefined
      },
      {interval: 0, timeout: 180_000}
    )
    const oldest = top.ordinals[0]!
    const mark = metroLogMark()
    await openMessageMenu(await rowText(oldest))
    await chooseMenuItem('Mark as unread')
    const logged = await waitFor(
      "the app's account of the mark",
      () => metroClientLogSince(mark).find(l => l.includes('marking unread messages')),
      {timeout: 10_000}
    )
    check(logged.includes('nothing older than'), `the app marked something: ${logged}`)
    // a line would be drawn within a frame of the answer; give it well past that
    for (const until = Date.now() + 2_000; Date.now() < until; ) {
      const lines = await orangeLineOrdinals()
      check(!lines.length, `the orange line after marking the first message unread: above ${lines.join(', ')}`)
    }
  })
})

describe('chat data: reply privately', () => {
  afterEach(async () => {
    // the quote was put in the direct conversation's composer, which saved it as its draft
    if ((await visibleConversation()) === data.direct.convID) await clearComposer()
  })

  it('reply privately opens the direct conversation with the message quoted in the composer', async () => {
    await openScratch()
    const text = `e2e-ios-data-private-${Date.now()}`
    await sendFromCli(E2E_CHANNELS.scratch, text)
    await waitForRow(text, 20_000)
    await rowElement(text).waitForExist({timeout: 10_000})

    await openMessageMenu(text)
    await chooseMenuItem('Reply privately')
    await waitFor('the direct conversation', async () => ((await visibleConversation()) === data.direct.convID ? true : undefined), {
      timeout: 15_000,
    })
    await waitForComposerText(`> ${text}\n`, 10_000)
  })
})

describe('chat data: incoming', () => {
  it('an incoming message reaches the open thread and the inbox snippet', async () => {
    await openDirect()
    const text = `e2e-ios-data-incoming-${Date.now()}`
    await sendDirectFromCli(data.direct.tlfName, text)
    await waitForRow(text, 20_000)
    check((await ordinalsWithText(text)).length === 1, 'the incoming message shows more than once')

    await hideKeyboard()
    await escapeToTabs()
    await navigateToChat()
    const row = browser.$(
      `-ios predicate string:name == ${JSON.stringify(T.CHAT_INBOX_ROW)} AND label BEGINSWITH ${JSON.stringify(`${data.secondUser},`)}`
    )
    await waitFor('the inbox snippet', async () => (((await row.getAttribute('label').catch(() => '')) ?? '').includes(text) ? true : undefined), {
      timeout: 10_000,
    })
  })
})

describe('chat data: account switch', () => {
  after(async () => {
    await switchAppAccount(data.smokeUser)
  })

  // The thread open when the account changes belongs to the account that left. Typing in its
  // composer right through the switch sends nothing for the next account (no typing, no draft save,
  // no post), and nothing on screen is left waiting on a call it never made. The switch goes through
  // the app's own switch, started while the keys are still being typed.
  it('typing through an account switch sends nothing for the next account and leaves nothing waiting', async () => {
    await openScratch()
    const token = `e2eswitchdraft${Date.now()}`
    await typeInComposer(token)
    // the draft saves for the account that typed it
    await browser.pause(1_000)
    const mark = metroLogMark()
    await markAccountChange()
    const typing = el(T.CHAT_INPUT)
      .addValue('x'.repeat(80))
      .catch(() => {})
    // switch once the composer is saving drafts of the keys coming in
    await waitFor(
      'a draft save of the keys being typed',
      () => (metroClientLogSince(mark).some(l => l.includes('<< OUTchat.1.local.updateUnsentText')) ? true : undefined),
      {interval: 50, timeout: 10_000}
    )
    await startAppAccountSwitch(data.secondUser)
    await typing
    await waitFor(
      'the switch to the second account',
      async () => {
        const a = await signedInAs().catch(() => undefined)
        return a && a.loggedIn && !a.switching && a.username === data.secondUser ? true : undefined
      },
      {interval: 500, timeout: 60_000}
    )
    // outlast the composer's 200ms draft save and 1s typing throttle, and a load or two
    await browser.pause(5_000)
    const calls = outgoingRpcs(metroClientLogSince(mark))
    const composerCalls = /^chat\.1\.local\.(updateUnsentText|updateTyping|post\w*)$/
    const before = calls.filter(c => !c.afterAccountChange && composerCalls.test(c.method))
    const after = calls.filter(c => c.afterAccountChange)
    console.log(`the composer's calls before the account changed: ${before.map(c => c.method).join(', ')}`)
    check(before.length > 0, 'the composer sent nothing while typing before the switch')
    check(after.length > 0, "no RPC in Metro's log after the account changed")
    const stray = after.filter(c => composerCalls.test(c.method)).map(c => `${c.method} ${c.params.slice(0, 120)}`)
    check(!stray.length, `the old composer's calls after the account changed: ${stray.join('; ')}`)
    const held = await heldWaitingKeys()
    check(!held.length, `waiting keys still held 5s after the switch: ${held.join(', ')}`)
  })

  it('a thread opened after switching accounts and back gets new messages for the account signed in', async () => {
    await openScratch()

    // as the second account: the thread builds for it and hears a message sent from its other device
    await switchAppAccount(data.secondUser)
    await openScratch()
    // a conversation opened right after the switch stays open (nothing selects one on its own)
    const shown = new Set<string | null>()
    for (const until = Date.now() + 1_500; Date.now() < until; ) shown.add(await visibleConversation())
    check(
      shown.size === 1 && shown.has(data.convIDs[E2E_CHANNELS.scratch]),
      `the screen showed ${[...shown].join(', ')} in the 1.5s after opening`
    )
    const whileSecond = `e2e-ios-data-switch-second-${Date.now()}`
    await sendFromCli(E2E_CHANNELS.scratch, whileSecond)
    await waitForRow(whileSecond, 20_000)

    // back as the smoke user: the thread builds again, with that message in it once
    await switchAppAccount(data.smokeUser)
    await openScratch()
    await waitForRow(whileSecond, 20_000)

    const incoming = `e2e-ios-data-switch-back-${Date.now()}`
    await sendFromCli(E2E_CHANNELS.scratch, incoming)
    await waitForRow(incoming, 20_000)
    check((await ordinalsWithText(incoming)).length === 1, 'the incoming message shows more than once')
  })
})

// A conversation opened from a link that the account has never joined (the closed subteam's
// channel: the smoke user administers the subteam but is not in it) stays up: the phone's open
// thread never moves on its own.
describe('chat data: a conversation never joined', () => {
  it('a conversation never joined, opened from a link, does not bounce', async () => {
    await hideKeyboard()
    await escapeToTabs()
    await navigateToChat()
    const mark = metroLogMark()
    openUrl(`keybase://convid/${data.closedConvID}`)
    await waitFor('the conversation to open', async () => ((await visibleConversation()) === data.closedConvID ? true : undefined), {
      timeout: 20_000,
    })
    const shown = new Set<string | null>()
    for (const until = Date.now() + 6_000; Date.now() < until; ) shown.add(await visibleConversation())
    const thread = await readThread()
    console.log(
      `never joined: its thread ${thread ? `lists ${thread.ordinals.length} rows` : 'is not drawn'}; the app logged: ${metroClientLogSince(mark)
        .filter(l => /thread load|not in|NotIn|conversationGone|selection/i.test(l))
        .slice(0, 5)
        .join(' | ')}`
    )
    check(
      shown.size === 1 && shown.has(data.closedConvID),
      `the screen showed ${[...shown].join(', ')} in the 6s after opening the conversation`
    )
  })
})

// A phone has no selection to move: its open thread stays where the user put it, even when the
// account leaves that channel on another device (the notification that moves a desktop's selection
// to the newest conversation). The host CLI runs as the second account for these flows, so the app
// signs in as it too; the channel is made for the run by the second account (a writer) and deleted
// by the smoke user (the owner) from the app afterwards.
describe('chat data: selection', () => {
  // Whether the inbox lists the channel. It drops the channel as the leave's notification arrives
  // (about 200ms after the CLI's leave); the channel's meta still says active well after.
  const inInbox = async (convID: string) =>
    jsEval<boolean>(
      `const ls = kbModule('chat/inbox/layout-state.tsx'); return !!ls.getBigLayoutChannelRow(ls.useInboxLayoutState.getState(), ${JSON.stringify(convID)})`
    )
  let channel: {convID: string; topicName: string} | undefined

  after(async () => {
    await switchAppAccount(data.smokeUser)
    if (channel) await deleteChannelAsApp(channel.convID, channel.topicName)
  })

  it("a phone's open thread stays open when the account leaves the channel on another device", async () => {
    channel = await createThrowawayChannel('e2e-phone')
    await switchAppAccount(data.secondUser)
    const {convID, topicName} = channel
    await openConversation(convID)
    await waitFor('the inbox to list the channel', async () => ((await inInbox(convID)) ? true : undefined), {timeout: 15_000})
    await leaveChannelFromCli(topicName)
    const shown = new Set<string | null>()
    let left = false
    for (const until = Date.now() + 5_000; Date.now() < until; ) {
      shown.add(await visibleConversation())
      left ||= !(await inInbox(convID))
    }
    // the app heard about the leave, so the thread staying put is its choice
    check(left, 'the inbox still lists the channel 5s after leaving it')
    check(
      shown.size === 1 && shown.has(convID),
      `the screen showed ${[...shown].join(', ')} in the 5s after leaving the channel elsewhere`
    )
  })
})
