// What the phone thread shows as its data changes, read off the thread store and the screen: a
// delete shows deleting and then takes the row away, reactions come and go, mark unread sets the
// orange line and the inbox's unread count, reply privately opens the direct conversation quoting
// the message, incoming messages reach the thread and the inbox, and all of it keeps working across
// an account switch.
import {
  E2E_CHANNELS,
  ensureChatData,
  sendDirectFromCli,
  sendFromCli,
  type ChatData,
} from '../../shared/chat-data'
import {
  check,
  chooseMenuItem,
  clearComposer,
  deletePhase,
  expectAtEnd,
  hideKeyboard,
  openConversation,
  openMessageMenu,
  ordinalsWithText,
  orangeLineOrdinals,
  rowElement,
  sendMessage,
  storedMessage,
  switchAppAccount,
  unreadCount,
  visibleConversation,
  waitForComposerText,
  waitForRow,
  type DeletePhase,
} from '../helpers/chat'
import {waitFor} from '../helpers/lifecycle'
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
