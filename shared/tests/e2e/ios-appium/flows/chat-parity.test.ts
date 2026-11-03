// Phone behaviour the desktop shares: the pinned banner steps aside for thread search and its close
// button unpins for everyone, and every Reply (the message menu, a swipe) closes search and hands the
// composer focus.
//
// The host stays on the smoke account: it reads back the conversation's pin and takes off one a
// failed test left. Every body is stamped with the run id.
import {E2E_CHANNELS, ensureChatData, type ChatData} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {convIDBytes} from '../../shared/conv-id.ts'
import {mainRpc} from '../../shared/main-rpc.ts'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {step} from '../gate/step'
import {
  closeMessageMenu,
  closeSearch,
  hideKeyboard,
  isKeyboardUp,
  messageIDAt,
  openConversation,
  openMessageMenu,
  openThreadSearch,
  pinnedBanner,
  replyPreview,
  resetComposer,
  rowCentre,
  searchOpen,
  sendMessage,
  showsText,
  waitForThreadStable,
} from '../helpers/chat'
import {check, chooseMenuItem} from '../helpers/menus'
import {expectHost, pinnedOnHost} from '../helpers/chat-host'
import {byText, el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'

describe('chat parity', function () {
  // no retries: a retry would let an intermittent race pass
  this.retries(0)

  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  sent  sendMessage 25
  //   menu      openMessageMenu 15 + chooseMenuItem 20 = 35;  close  5;  keyboard  5
  //   search    openThreadSearch 20, closeSearch 5;  stable  waitForThreadStable 10
  //   pin       the host's read of the pin polled 95 (20, overrun by one read: whoami 15 and the call
  //             60);  unpin  the host's unpin 75 (whoami 15, the call 60) and its read 95 = 170
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    this.timeout(20 * 60_000) // a first run seeds; later runs only check
    data = await ensureChatData()
  })

  const scratch = () => data.convIDs[E2E_CHANNELS.scratch]
  const openScratch = async () => openConversation(scratch())

  const expectPinnedOnHost = async (what: string, want: number | null) =>
    expectHost(what, async () => pinnedOnHost(scratch()), p => p === want)

  // Takes a pin a failed test left off e2e-scratch from the host, and reads it gone. Cleanup and a
  // test's starting point: nothing when nothing is pinned.
  const unpinFromHost = async () => {
    if ((await pinnedOnHost(scratch())) === null) return
    await mainRpc('chat.1.local.unpinMessage', {convID: convIDBytes(scratch())})
    await expectPinnedOnHost('no pin', null)
  }

  // The text the pinned banner shows, read from its accessibility label.
  const bannerSays = async (text: string) => ((await pinnedBanner().getAttribute('label')) ?? '').includes(text)

  // e2e-scratch with search closed, no reply or menu open and an empty composer, after a timeout
  // too. Worst case (s): close 19, keyboard 5, open 100, search 5, resetComposer 46 = 175.
  afterEach(async function () {
    this.timeout(180_000)
    await withCleanup(closeMessageMenu, [
      hideKeyboard,
      async () => {
        await openScratch()
        if (await searchOpen()) await closeSearch()
        await resetComposer()
      },
    ])
  })

  describe('pinned banner', () => {
    // No pin left on e2e-scratch, after a timeout too. Worst case (s): unpin 170 + its first read 95.
    afterEach(async function () {
      this.timeout(280_000)
      await unpinFromHost()
    })

    it('the pinned banner hides while thread search is open, and its close button unpins', async function () {
      // worst case (s): unpin 265, open 100, sent 25, the id 10, keyboard 5, menu 35, the banner 10,
      // its text 5, pin 95, step 2, search 20, the banner gone 5, step 2, close 5, the banner 5, its
      // text 1, step 2, keyboard 5, the tap 1, the prompt 5, the tap 1, the banner gone 10, pin 95,
      // step 2 = 711
      this.timeout(740_000)
      await unpinFromHost()
      await openScratch()
      const text = e2eMarker('parity-pin')
      const ordinal = await sendMessage(text)
      const id = await messageIDAt(ordinal)
      await hideKeyboard()
      await openMessageMenu(text)
      await chooseMenuItem('Pin message')
      await pinnedBanner().waitForExist({timeout: 10_000})
      await waitFor('the banner to show the pinned message', async () => ((await bannerSays(text)) ? true : undefined), {
        timeout: 5_000,
      })
      await expectPinnedOnHost('the message pinned', id)
      await step('Pinned: the banner shows the message, the host reads it pinned')

      await openThreadSearch()
      await pinnedBanner().waitForExist({reverse: true, timeout: 5_000})
      await step('Thread search open: the banner is hidden')

      await closeSearch()
      await pinnedBanner().waitForExist({timeout: 5_000})
      check(await bannerSays(text), 'the banner came back without the pinned message')
      await step('Search closed: the banner is back')

      // the account pinned it, so the close asks before unpinning for everyone
      await hideKeyboard()
      await el(T.CHAT_PINNED_UNPIN).click()
      await el(T.CHAT_UNPIN_PROMPT).waitForExist({timeout: 5_000})
      await byText('Yes, unpin').click()
      await pinnedBanner().waitForExist({reverse: true, timeout: 10_000})
      await expectPinnedOnHost('no pin', null)
      await step('Unpinned from the banner: gone here and on the host', {card: true})
    })
  })

  describe('reply', () => {
    // Opens search, then starts a reply to a new message through `reply`, and checks the reply opened
    // the same way: the reply bar names the message, search is closed, the composer has the keyboard.
    const replyClosesSearchAndFocuses = async (reply: (text: string) => Promise<void>) => {
      await openScratch()
      const text = e2eMarker('parity-reply')
      await sendMessage(text)
      await hideKeyboard()
      await openThreadSearch()
      await hideKeyboard()
      await waitForThreadStable()
      await step('Thread search open over a new message')

      await reply(text)

      await replyPreview().waitForExist({timeout: 5_000})
      await waitFor('the reply bar to quote the message', async () => ((await showsText(T.CHAT_REPLY_PREVIEW, text)) ? true : undefined), {
        timeout: 5_000,
      })
      await el(T.CHAT_THREAD_SEARCH).waitForExist({reverse: true, timeout: 5_000})
      await waitFor('the composer to take the keyboard', async () => ((await isKeyboardUp()) ? true : undefined), {
        timeout: 5_000,
      })
      check(await el(T.CHAT_INPUT).isExisting(), 'the composer is not showing')
      await step('Replying: search closed, the reply bar quotes the message, the composer has the keyboard', {card: true})
    }

    it('Reply from the message menu closes search and focuses the composer', async function () {
      // worst case (s): open 100, sent 25, keyboard 5, search 20, keyboard 5, stable 10, step 2, menu
      // 35, the bar 5, its text 5, search gone 5, keyboard 5, the read 1, step 2 = 225
      this.timeout(250_000)
      await replyClosesSearchAndFocuses(async text => {
        await openMessageMenu(text)
        await chooseMenuItem('Reply')
      })
    })

    it('swiping a message to reply closes search and focuses the composer', async function () {
      // worst case (s): open 100, sent 25, keyboard 5, search 20, keyboard 5, stable 10, step 2, the
      // swipe 2, the bar 5, its text 5, search gone 5, keyboard 5, the read 1, step 2 = 192
      this.timeout(210_000)
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
})
