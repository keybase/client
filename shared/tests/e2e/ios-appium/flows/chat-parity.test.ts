// Phone behaviour the desktop shares: the pinned banner steps aside for thread search, every Reply
// (the message menu, a swipe) closes search and hands the composer focus, and an inline video's
// corner button opens it fullscreen.
import {E2E_CHANNELS, ensureChatData, type ChatData} from '../../shared/chat-data'
import {
  check,
  chooseMenuItem,
  closeSearch,
  hideKeyboard,
  isKeyboardUp,
  openConversation,
  openMessageMenu,
  openThreadSearch,
  pinnedBanner,
  replyPreview,
  rowCentre,
  searchOpen,
  sendMessage,
  showsText,
  waitForThreadStable,
} from '../helpers/chat'
import {byText, el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {goBackUntilGone} from '../helpers/navigate'
import * as T from '../../shared/test-ids'

let data: ChatData
before(async () => {
  data = await ensureChatData()
})

const openScratch = async () => openConversation(data.convIDs[E2E_CHANNELS.scratch])

// Unpins whatever is pinned in the open conversation, through the banner's close button (its right
// end) and the confirmation. The smoke user pins everything these flows pin, so the close asks to
// unpin for everyone.
const unpin = async () => {
  if (!(await pinnedBanner().isExisting())) return
  await hideKeyboard()
  const {x, y} = await pinnedBanner().getLocation()
  const {height, width} = await pinnedBanner().getSize()
  await browser.execute('mobile: tap', {x: Math.round(x + width - 22), y: Math.round(y + height / 2)})
  const confirm = byText('Yes, unpin')
  await confirm.waitForExist({timeout: 5_000})
  await confirm.click()
  await pinnedBanner().waitForExist({reverse: true, timeout: 10_000})
}

// The text the pinned banner shows, read from its accessibility label.
const bannerSays = async (text: string) => ((await pinnedBanner().getAttribute('label')) ?? '').includes(text)

describe('chat parity: pinned banner', () => {
  afterEach(async () => {
    if (await searchOpen()) await closeSearch()
    await unpin()
  })

  it('the pinned banner hides while thread search is open', async () => {
    await openScratch()
    await unpin()
    const text = `e2e-ios-parity-pin-${Date.now()}`
    await sendMessage(text)
    await hideKeyboard()
    await openMessageMenu(text)
    await chooseMenuItem('Pin message')
    await pinnedBanner().waitForExist({timeout: 10_000})
    await waitFor('the banner to show the pinned message', async () => ((await bannerSays(text)) ? true : undefined), {
      timeout: 5_000,
    })

    await openThreadSearch()
    await pinnedBanner().waitForExist({reverse: true, timeout: 5_000})

    await closeSearch()
    await pinnedBanner().waitForExist({timeout: 5_000})
    check(await bannerSays(text), 'the banner came back without the pinned message')
  })
})

describe('chat parity: reply', () => {
  afterEach(async () => {
    if (await searchOpen()) await closeSearch()
    if (await replyPreview().isExisting()) await el(T.CHAT_REPLY_CANCEL).click()
    await replyPreview().waitForExist({reverse: true, timeout: 5_000})
  })

  // Opens search, then starts a reply to a new message through `reply`, and checks the reply opened
  // the same way: the reply bar names the message, search is closed, the composer has the keyboard.
  const replyClosesSearchAndFocuses = async (reply: (text: string) => Promise<void>) => {
    await openScratch()
    const text = `e2e-ios-parity-reply-${Date.now()}`
    await sendMessage(text)
    await hideKeyboard()
    await openThreadSearch()
    await hideKeyboard()
    await waitForThreadStable()

    await reply(text)

    await replyPreview().waitForExist({timeout: 5_000})
    await waitFor(
      'the reply bar to quote the message',
      async () => ((await showsText(T.CHAT_REPLY_PREVIEW, text)) ? true : undefined),
      {timeout: 5_000}
    )
    await el(T.CHAT_THREAD_SEARCH).waitForExist({reverse: true, timeout: 5_000})
    await waitFor('the composer to take the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {
      timeout: 5_000,
    })
    check(await el(T.CHAT_INPUT).isExisting(), 'the composer is not showing')
  }

  it('Reply from the message menu closes search and focuses the composer', async () => {
    await replyClosesSearchAndFocuses(async text => {
      await openMessageMenu(text)
      await chooseMenuItem('Reply')
    })
  })

  it('swiping a message to reply closes search and focuses the composer', async () => {
    await replyClosesSearchAndFocuses(async text => {
      const {y} = await rowCentre(text)
      const {width} = await browser.getWindowRect()
      await browser
        .action('pointer', {parameters: {pointerType: 'touch'}})
        .move({x: Math.round(width * 0.8), y})
        .down()
        .move({duration: 300, x: Math.round(width * 0.3), y})
        .up()
        .perform()
    })
  })
})

describe('chat parity: inline video', () => {
  it('the corner button opens the video fullscreen', async () => {
    await openConversation(data.convIDs[E2E_CHANNELS.media])
    await waitForThreadStable()
    const buttons = await browser.$$(`~${T.CHAT_VIDEO_FULLSCREEN}`).getElements()
    check(buttons.length > 0, 'no video with a fullscreen button in view')
    // the seeded video posted last is the newest one
    await buttons.at(-1)!.click()
    await el(T.CHAT_ATTACHMENT_FULLSCREEN).waitForExist({timeout: 10_000})
    await goBackUntilGone(T.CHAT_ATTACHMENT_FULLSCREEN)
  })
})
