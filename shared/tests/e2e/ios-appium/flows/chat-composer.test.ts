// The phone composer, read off the input, the inbox and the thread: drafts survive leaving and an
// app relaunch, a send takes the text and the draft with it, an edit is never a draft, the reply bar
// cancels, the suggestion lists pick by tap, an emoji from the picker lands with its space, and a
// read-only channel hides every way to post.
import {
  E2E_CHANNELS,
  createThrowawayChannel,
  deleteThrowawayChannels,
  ensureChatData,
  readonlyMarker,
  setMinWriterRoleFromCli,
  type ChatData,
} from '../../shared/chat-data'
import {switchCliAccount} from '../../shared/cli-account'
import {
  check,
  chooseMenuItem,
  clearComposer,
  closeMessageMenu,
  closeSearch,
  composerText,
  editCancel,
  hideKeyboard,
  isKeyboardUp,
  menuHas,
  openConversation,
  openMessageMenu,
  openThreadSearch,
  outgoingRpcs,
  replyPreview,
  sendMessage,
  ordinalsWithText,
  storedMessage,
  switchAppAccount,
  typeInComposer,
  waitForComposerText,
  waitForRow,
} from '../helpers/chat'
import {el, els} from '../helpers/elements'
import {
  BUNDLE_ID,
  deviceUdid,
  jsEval,
  metroClientLogSince,
  metroLogMark,
  simctl,
  terminateApp,
  waitFor,
} from '../helpers/lifecycle'
import {escapeToTabs, navigateToChat} from '../helpers/navigate'
import * as T from '../../shared/test-ids'

let data: ChatData
before(async () => {
  data = await ensureChatData()
})

const openDirect = async () => openConversation(data.direct.convID)
const openScratch = async () => openConversation(data.convIDs[E2E_CHANNELS.scratch])

// Ends whatever the composer holds (an edit, a reply, text), which saves an empty draft.
const resetComposer = async () => {
  if (!(await el(T.CHAT_INPUT).isExisting())) return
  if (await editCancel().isExisting()) await editCancel().click()
  if (await replyPreview().isExisting()) await el(T.CHAT_REPLY_CANCEL).click()
  await editCancel().waitForExist({reverse: true, timeout: 5_000})
  await replyPreview().waitForExist({reverse: true, timeout: 5_000})
  await clearComposer()
}

// The direct conversation's inbox row, which shows a saved draft as "Draft: <text>" while the
// conversation is not open. Its label reads "<name>, <time>, <snippet>".
const directRowLabel = async () => {
  await hideKeyboard()
  await escapeToTabs()
  await navigateToChat()
  const row = browser.$(
    `-ios predicate string:name == ${JSON.stringify(T.CHAT_INBOX_ROW)} AND label BEGINSWITH ${JSON.stringify(`${data.secondUser},`)}`
  )
  await row.waitForExist({timeout: 10_000, timeoutMsg: 'no inbox row for the direct conversation'})
  return (await row.getAttribute('label')) ?? ''
}

const expectDirectDraft = async (draft: string | undefined) => {
  await waitFor(
    `the direct conversation's inbox row to show ${draft === undefined ? 'no draft' : `the draft "${draft}"`}`,
    async () => {
      const label = await directRowLabel()
      const ok = draft === undefined ? !label.includes('Draft') : label.includes('Draft') && label.includes(draft)
      return ok ? true : undefined
    },
    {interval: 500, timeout: 10_000}
  )
}

// Starts editing the message showing `text` from its menu.
const startEdit = async (text: string) => {
  await hideKeyboard()
  await openMessageMenu(text)
  await chooseMenuItem('Edit')
  await editCancel().waitForExist({timeout: 5_000})
  await waitForComposerText(text)
}

// The message sent as `text` still reads exactly that. Found by its text: a row sent this session is
// renumbered when the thread loads again.
const expectStoredText = async (text: string) => {
  const found = await ordinalsWithText(text)
  check(found.length === 1, `${found.length} messages contain "${text}"`)
  const m = await storedMessage(found[0]!)
  check(m?.text === text, `the message reads "${m?.text}", not "${text}"`)
}

describe('chat composer: drafts', () => {
  afterEach(async () => {
    await openDirect()
    await resetComposer()
  })

  it('a draft survives a conversation switch and an app relaunch', async () => {
    await openDirect()
    await resetComposer()
    const draft = `e2e-ios-composer-draft-${Date.now()}`
    await typeInComposer(draft)

    await openScratch()
    await expectDirectDraft(draft)
    await openDirect()
    await waitForComposerText(draft)

    // leave again so the draft is saved to the service, then relaunch the app
    await openScratch()
    await expectDirectDraft(draft)
    await terminateApp()
    simctl('launch', deviceUdid(), BUNDLE_ID)
    await waitFor(
      'the relaunched app to sign in',
      async () =>
        (await jsEval<boolean>(`return kbModule('stores/config.tsx').useConfigState.getState().loggedIn`).catch(() => false))
          ? true
          : undefined,
      {interval: 1_000, timeout: 90_000}
    )
    await expectDirectDraft(draft)
    await openDirect()
    await waitForComposerText(draft)
  })

  it('a send clears the composer and the saved draft', async () => {
    await openDirect()
    await resetComposer()
    const text = `e2e-ios-composer-send-${Date.now()}`
    await sendMessage(text)
    await waitForComposerText('')

    await openScratch()
    await expectDirectDraft(undefined)
    await openDirect()
    await waitForComposerText('')
  })

  it('typing straight after a send is not erased', async () => {
    await openDirect()
    await resetComposer()
    const text = `e2e-ios-composer-quick-${Date.now()}`
    await typeInComposer(text)
    await el(T.CHAT_SEND_BUTTON).click()
    await el(T.CHAT_INPUT).addValue('next')
    await waitForRow(text)
    // the sent row has landed and the list has settled; what was typed after the send is all there
    await browser.pause(500)
    await waitForComposerText('next')
  })
})

describe('chat composer: editing', () => {
  afterEach(async () => {
    await openDirect()
    await resetComposer()
  })

  it('Edit from the menu puts the message in the composer, and Cancel ends it', async () => {
    await openDirect()
    await resetComposer()
    const text = `e2e-ios-composer-edit-${Date.now()}`
    await sendMessage(text)
    await startEdit(text)

    await editCancel().click()
    await editCancel().waitForExist({reverse: true, timeout: 5_000})
    await waitForComposerText('')
    await expectStoredText(text)
  })

  it('leaving mid-edit discards the edit and saves no draft', async () => {
    await openDirect()
    await resetComposer()
    const text = `e2e-ios-composer-leave-${Date.now()}`
    await sendMessage(text)
    await startEdit(text)
    await el(T.CHAT_INPUT).addValue(' changed')
    await waitForComposerText(`${text} changed`)
    // well past the draft save's throttle, so a save of the edit text would have gone out
    await browser.pause(500)

    await openScratch()
    await expectDirectDraft(undefined)
    await openDirect()
    check(!(await editCancel().isExisting()), 'the edit is still open')
    await waitForComposerText('')
    await expectStoredText(text)
  })

  it('leaving mid-edit keeps the draft from before the edit', async () => {
    await openDirect()
    await resetComposer()
    const text = `e2e-ios-composer-leave-draft-${Date.now()}`
    await sendMessage(text)
    const draft = `e2e-ios-composer-pre-edit-${Date.now()}`
    await typeInComposer(draft)
    await startEdit(text)
    await el(T.CHAT_INPUT).addValue(' changed')
    await waitForComposerText(`${text} changed`)
    await browser.pause(500)

    await openScratch()
    await expectDirectDraft(draft)
    await openDirect()
    check(!(await editCancel().isExisting()), 'the edit is still open')
    await waitForComposerText(draft)
    await expectStoredText(text)
  })

  it('cancelling an edit puts the draft from before it back', async () => {
    await openDirect()
    await resetComposer()
    const text = `e2e-ios-composer-cancel-${Date.now()}`
    await sendMessage(text)
    const draft = `e2e-ios-composer-pre-cancel-${Date.now()}`
    await typeInComposer(draft)
    await startEdit(text)
    await el(T.CHAT_INPUT).addValue(' changed')
    await browser.pause(500)

    await editCancel().click()
    await editCancel().waitForExist({reverse: true, timeout: 5_000})
    await waitForComposerText(draft)

    await openScratch()
    await expectDirectDraft(draft)
    await openDirect()
    await waitForComposerText(draft)
    await expectStoredText(text)
  })

  it('Edit from the menu raises the keyboard once the menu is gone', async () => {
    await openDirect()
    await resetComposer()
    const text = `e2e-ios-composer-edit-focus-${Date.now()}`
    await sendMessage(text)
    await startEdit(text)
    await waitFor('the composer to take the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {
      timeout: 5_000,
    })
    // the keys go to the focused composer, into the edit
    await browser.keys([' ', 'x'])
    await waitForComposerText(`${text} x`)
  })

  // On a phone thread search takes the composer's place, and closing it attaches a new input.
  it("an edit's text comes back after thread search, sending posts the edit, and no draft is saved", async () => {
    await openDirect()
    await resetComposer()
    const text = `e2e-ios-composer-edit-search-${Date.now()}`
    await sendMessage(text)
    await startEdit(text)
    await el(T.CHAT_INPUT).addValue(' edited')
    await waitForComposerText(`${text} edited`)
    await browser.pause(500)

    await openThreadSearch()
    await el(T.CHAT_INPUT).waitForExist({reverse: true, timeout: 5_000})
    await closeSearch()
    await waitForComposerText(`${text} edited`)
    check(await editCancel().isExisting(), 'the edit ended across thread search')

    await el(T.CHAT_SEND_BUTTON).click()
    await editCancel().waitForExist({reverse: true, timeout: 5_000})
    await waitForComposerText('')
    await waitFor(
      'the message to read the edited text',
      async () => {
        const found = await ordinalsWithText(`${text} edited`)
        const m = found.length === 1 ? await storedMessage(found[0]!) : undefined
        return m?.text === `${text} edited` ? true : undefined
      },
      {timeout: 15_000}
    )
    await openScratch()
    await expectDirectDraft(undefined)
  })
})

describe('chat composer: reply and suggestions', () => {
  afterEach(async () => {
    await resetComposer()
    await el(T.CHAT_SUGGESTION_LIST).waitForExist({reverse: true, timeout: 5_000})
  })

  it('the reply bar shows, and its close button cancels it', async () => {
    await openScratch()
    await resetComposer()
    const text = `e2e-ios-composer-reply-${Date.now()}`
    await sendMessage(text)
    await hideKeyboard()
    await openMessageMenu(text)
    await chooseMenuItem('Reply')
    await replyPreview().waitForExist({timeout: 5_000})
    await el(T.CHAT_REPLY_CANCEL).click()
    await replyPreview().waitForExist({reverse: true, timeout: 5_000})
  })

  // The open list's rows, top to bottom; the highlighted one carries its own testID.
  const suggestionRows = async () => {
    const found = [
      ...(await els(T.CHAT_SUGGESTION_ROW).getElements()),
      ...(await els(T.CHAT_SUGGESTION_ROW_SELECTED).getElements()),
    ]
    const placed = await Promise.all(found.map(async e => ({e, y: (await e.getLocation()).y})))
    return placed.sort((a, b) => a.y - b.y).map(p => p.e)
  }

  // Types `text` into an empty composer and waits for the list to offer at least `rows` rows.
  const openList = async (text: string, rows: number) => {
    await openScratch()
    await resetComposer()
    await typeInComposer(text)
    await el(T.CHAT_SUGGESTION_LIST).waitForExist({timeout: 10_000})
    await waitFor('the suggestion rows', async () => ((await suggestionRows()).length >= rows ? true : undefined), {
      timeout: 10_000,
    })
    return suggestionRows()
  }

  // A suggestion row's text (its label merges what it shows).
  const rowLabel = async (row: WebdriverIO.Element) => ((await row.getAttribute('label')) ?? '').trim()

  it('@mention list: tapping a row puts that name in the composer', async () => {
    const rows = await openList('@', 2)
    const label = await rowLabel(rows[1]!)
    const name = label.split(/[ ,]/).find(w => !!w) ?? ''
    check(!!name, `the row has no name: "${label}"`)
    await rows[1]!.click()
    await el(T.CHAT_SUGGESTION_LIST).waitForExist({reverse: true, timeout: 5_000})
    await waitForComposerText(`@${name} `)
  })

  it('emoji list: tapping a row puts that emoji in the composer', async () => {
    const rows = await openList(':tada', 1)
    const label = await rowLabel(rows[0]!)
    await rows[0]!.click()
    await el(T.CHAT_SUGGESTION_LIST).waitForExist({reverse: true, timeout: 5_000})
    const text = await composerText()
    check(/^:tada[\w-]*: $/.test(text), `the composer reads "${text}" after picking "${label}"`)
  })

  // Arrowing through the list shows the pick in the composer (a preview) without it being typed;
  // leaving with one showing keeps it as the draft and sends no typing for it. What the app sends is
  // read off its RPC log in Metro's log; the other account is not watched. Arrows come only from a
  // hardware keyboard, which Appium reaches only where XCTest synthesizes hardware key presses.
  it('leaving with an @mention preview keeps it as the draft and sends no typing', async function () {
    const rows = await openList('@', 2)
    const second = ((await rowLabel(rows[1]!)).split(/[ ,]/).find(w => !!w)) ?? ''
    check(!!second, 'the second row has no name')
    await browser.execute('mobile: keys', {
      elementId: (await el(T.CHAT_INPUT).getElement()).elementId,
      // XCUIKeyboardKeyDownArrow
      keys: [{key: '\uF701', modifierFlags: 0}],
    })
    const previewed = await waitForComposerText(`@${second}`, 3_000)
      .then(() => true)
      .catch(() => false)
    if (!previewed && (await composerText()) === '@') {
      console.log('skipped: a hardware arrow key from Appium does not reach the app on this simulator')
      this.skip()
    }
    check(previewed, `the arrow left the composer reading ${JSON.stringify(await composerText())}`)
    // past the typing throttle (1s), so the typing from before the leave has all gone out
    await browser.pause(1_500)
    const mark = metroLogMark()
    await openDirect()
    await browser.pause(1_500)
    const calls = outgoingRpcs(metroClientLogSince(mark))
    const typingOn = calls.filter(c => c.method === 'chat.1.local.updateTyping' && /"typing":\s*true/.test(c.params))
    check(typingOn.length === 0, `typing sent after leaving: ${JSON.stringify(typingOn)}`)
    await openScratch()
    await waitForComposerText(`@${second}`)
  })

  it('an emoji from the picker goes in after the text with one space after it', async () => {
    await openScratch()
    await resetComposer()
    await typeInComposer('hello ')
    await hideKeyboard()
    await el(T.CHAT_EMOJI_BUTTON).click()
    await el(T.CHAT_EMOJI_PICKER).waitForExist({timeout: 5_000})
    // the search box is a button until tapped, and the field it opens is not in the accessibility
    // tree, so the keys go to whatever has focus
    await browser.$('-ios predicate string:label BEGINSWITH "Search" AND visible == 1').click()
    await waitFor('the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {timeout: 5_000})
    // one key per action: WDA refuses an action that presses the same key twice
    for (const key of 'tada') await browser.keys(key)
    // with or without the emoji-presentation selector
    const tada = browser.$(
      `-ios predicate string:(label BEGINSWITH "\u{1F389}\u{FE0F}" OR label == "\u{1F389}") AND visible == 1 AND NOT (label CONTAINS ", ")`
    )
    await tada.waitForExist({timeout: 5_000})
    await tada.click()
    await el(T.CHAT_EMOJI_PICKER).waitForExist({reverse: true, timeout: 5_000})
    await waitForComposerText('hello :tada: ')
  })
})

// Hardware keys reach the app through UIKit's key presses (AppDelegate.pressesBegan). Appium sends
// them as XCTest key events, which reach that path only where XCTest synthesizes hardware key
// presses for the device: on the iPhone simulator here `mobile: keys` returns and the composer is
// unchanged, so the flow skips when a Shift-Enter changes nothing.
describe('chat composer: hardware keyboard', () => {
  afterEach(async () => {
    await resetComposer()
  })

  const pressKey = async (key: string, modifierFlags = 0) =>
    browser.execute('mobile: keys', {elementId: (await el(T.CHAT_INPUT).getElement()).elementId, keys: [{key, modifierFlags}]})
  // XCUIKeyModifierShift
  const shift = 1 << 17

  it('Enter sends and Shift-Enter inserts a newline', async function () {
    await openScratch()
    await resetComposer()
    await typeInComposer('ab')
    await pressKey('\r', shift)
    const reached = await waitForComposerText('ab\n', 3_000)
      .then(() => true)
      .catch(() => false)
    if (!reached && (await composerText()) === 'ab') {
      console.log('skipped: a hardware Shift-Enter from Appium does not reach the app on this simulator')
      this.skip()
    }
    check(reached, `Shift-Enter left the composer reading ${JSON.stringify(await composerText())}`)
    const text = `e2e-ios-composer-enter-${Date.now()}`
    await clearComposer()
    await typeInComposer(text)
    await pressKey('\r')
    await waitForRow(text)
    await waitForComposerText('')
  })
})

// The second account is a writer; e2e-readonly takes posts from admins only.
describe('chat composer: read-only channel', () => {
  after(async () => {
    await closeMessageMenu().catch(() => {})
    await switchAppAccount(data.smokeUser)
  })

  const postingButtons = [
    T.CHAT_EMOJI_BUTTON,
    T.CHAT_MENTION_BUTTON,
    T.CHAT_CAMERA_BUTTON,
    T.CHAT_AUDIO_BUTTON,
    T.CHAT_MORE_BUTTON,
  ] as const

  it('as a writer: every way to post is hidden, and the menu offers no edit or reply', async () => {
    await switchAppAccount(data.secondUser)
    // where the second account can post, every button shows
    await openScratch()
    await resetComposer()
    for (const id of postingButtons) {
      check(await el(id).isExisting(), `${id} does not show where the account can post`)
    }
    await typeInComposer('x')
    await el(T.CHAT_SEND_BUTTON).waitForExist({timeout: 5_000})
    await clearComposer()

    await openConversation(data.convIDs[E2E_CHANNELS.readonly])
    await waitForRow(readonlyMarker(1))
    for (const id of [...postingButtons, T.CHAT_SEND_BUTTON]) {
      check(!(await el(id).isExisting()), `${id} shows in a channel the account cannot post to`)
    }
    await el(T.CHAT_INPUT).click().catch(() => {})
    await el(T.CHAT_INPUT).addValue('e2e-readonly-typed').catch(() => {})
    await browser.pause(500)
    check(!(await el(T.CHAT_SEND_BUTTON).isExisting()), 'typing in a read-only channel offers a send button')
    await hideKeyboard()

    await openMessageMenu(readonlyMarker(1))
    check(await menuHas('Copy text'), 'the message menu did not open fully')
    check(!(await menuHas('Edit')), 'the message menu offers Edit')
    check(!(await menuHas('Reply')), 'the message menu offers Reply')
    await closeMessageMenu()
  })
})

// The channel turns read-only for the second account (a writer) while it edits: the owner, the host
// CLI, raises the channel's minimum writer role. Cancelling the edit then empties the composer and
// leaves the draft set aside for the edit as it was; it loads again once the account can post.
describe('chat composer: read-only mid-edit', () => {
  const prefix = 'e2e-iroedit'

  after(async () => {
    await closeMessageMenu().catch(() => {})
    await switchAppAccount(data.smokeUser)
    await switchCliAccount(data.smokeUser)
    await deleteThrowawayChannels(prefix)
    await switchCliAccount(data.secondUser)
  })

  it('cancelling the edit empties the composer and leaves the draft, which comes back once it can post', async () => {
    await switchCliAccount(data.smokeUser)
    await deleteThrowawayChannels(prefix)
    const {convID, topicName} = await createThrowawayChannel(prefix)
    await switchAppAccount(data.secondUser)
    await openConversation(convID)
    await el(T.CHAT_EMOJI_BUTTON).waitForExist({timeout: 10_000})

    const text = `e2e-ios-roedit-message-${Date.now()}`
    await sendMessage(text)
    const draft = `e2e-ios-roedit-draft-${Date.now()}`
    await typeInComposer(draft)
    // past the draft save's throttle, so the draft is saved before the edit sets it aside
    await browser.pause(500)
    await startEdit(text)
    await el(T.CHAT_INPUT).addValue(' changed')
    await waitForComposerText(`${text} changed`)

    await setMinWriterRoleFromCli(topicName, 'admin')
    await el(T.CHAT_EMOJI_BUTTON).waitForExist({reverse: true, timeout: 20_000})
    await hideKeyboard()
    await editCancel().waitForExist({timeout: 5_000})
    await editCancel().click()
    await editCancel().waitForExist({reverse: true, timeout: 5_000})
    await waitForComposerText('')
    await expectStoredText(text)

    await setMinWriterRoleFromCli(topicName, 'writer')
    await el(T.CHAT_EMOJI_BUTTON).waitForExist({timeout: 20_000})
    await waitForComposerText(draft, 10_000)
    await expectStoredText(text)
  })
})
