// Attachments on the phone that it did not upload itself (the phone's own uploads go through the
// photo picker, which is another flow's): an image and a video the second account attaches show
// inline and open fullscreen; collapsed by /collapse, one expands from its row and stays expanded
// through a relaunch; the account's own file, attached from another device (the host), is deleted
// from its menu and the host no longer has it; and the info panel's Media and Docs list them.
//
// Everything lands in one throwaway channel of KB_E2E_TEAM, made and deleted by the host (the
// owner), so /collapse touches nothing else and nothing is left behind. Every title is stamped
// with the run id.
import {loadE2EEnv} from '../../accounts/env'
import {
  attachToThrowawayFromCli,
  createThrowawayChannel,
  deleteThrowawayChannel,
  ensureChatData,
  type CliMessage,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {corpusEntry} from '../../fixtures/corpus/corpus'
import {sendWithRetry} from '../../shared/peer-actors'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {isAttemptOver} from '../gate/attempt-binding-lib'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {requireSecondNotBlocked} from '../gate/blocks'
import {step} from '../gate/step'
import {
  closeInfoPanel,
  closeMessageMenu,
  deletePhase,
  elementInRow,
  expectPersists,
  galleryListing,
  hideKeyboard,
  openConversation,
  openHeaderMenuItem,
  openMessageMenu,
  ordinalsWithText,
  scrollRowIntoView,
  storedAttachment,
  type StoredAttachment,
  tapTextIn,
  typeInComposer,
  videoFullscreenButton,
  waitForComposerText,
  waitForRow,
  waitForThreadStable,
} from '../helpers/chat'
import {check, chooseMenuItem} from '../helpers/menus'
import {expectCli, secondSender} from '../helpers/chat-host'
import {el} from '../helpers/elements'
import {appSnapshot, waitFor} from '../helpers/lifecycle'
import {goBackUntilGone} from '../helpers/navigate'

describe('chat attachments', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  sent  sendMessage 25;  keyboard  5
  //   peer      the peer found, on a test's first attach, 45, and a failing call's diagnosis 25 = 70;
  //             attach  one peer attach 60;  host  one host attach 60
  //   landed    the row 60, then the attachment ready 60 = 120
  //   view      scrollRowIntoView 30;  in row  elementInRow 2
  //   full      the fullscreen 10, the screen 1, the back 10, gone 5 = 26
  //   menu      openMessageMenu 15 + chooseMenuItem 20 = 35;  close  5
  //   cli       a host read polled 80 (20, overrun by one read's 60)
  //   calls     the recorder's call log, one read 2;  waited for  10
  //   relaunch  relaunchApp 200 (two checkpoints and the new runtime's 120), signed in 90
  //   panel     the header menu 15, the panel 10, a tab 10, a listing polled 20 = 55
  //   step      2 (its 1s settle and the attach)

  // The throwaway channel every test here posts to: made once by the host, deleted after the last.
  let channel: {convID: string; topicName: string} | undefined
  const convID = () => {
    if (!channel) throw new Error('the throwaway channel was not made')
    return channel.convID
  }
  const topicName = () => {
    if (!channel) throw new Error('the throwaway channel was not made')
    return channel.topicName
  }

  // Host-side setup only: the channel with the second account in it, and a first message from the
  // peer, which waits until the peer's inbox lists a channel this new. Worst case (s): seeding 20
  // minutes on a first run (the second account's membership), the block check 75, channel 240, peer
  // 70, the send 90 = 20 minutes + 475.
  before(async function () {
    this.timeout(20 * 60_000 + 500_000)
    await ensureChatData()
    // the second account's messages and switches need it unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
    channel = await createThrowawayChannel('attach')
    await sendWithRetry(await secondSender(), channel.convID, e2eMarker('attach-hello'))
  })

  // Worst case (s): delete 120.
  after(async function () {
    this.timeout(140_000)
    if (channel) await deleteThrowawayChannel(channel.topicName)
  })

  // No menu, keyboard or fullscreen view left open, after a timeout too. Worst case (s): close 19,
  // keyboard 5, the back 10, gone 5 = 39.
  afterEach(async function () {
    this.timeout(40_000)
    await withCleanup(closeMessageMenu, [
      hideKeyboard,
      async () => {
        if (!(await el(T.CHAT_ATTACHMENT_FULLSCREEN).isExisting())) return
        await goBackUntilGone(T.CHAT_ATTACHMENT_FULLSCREEN)
        await el(T.CHAT_ATTACHMENT_FULLSCREEN).waitForExist({reverse: true, timeout: 5_000})
      },
    ])
  })

  const attachIncoming = async (file: string, title: string) => (await secondSender()).attach(convID(), corpusEntry(file).file, title)

  // Waits for the attachment titled `title` to land in the open thread drawn as `renderType`, its
  // preview ready and no transfer under way, and returns its ordinal and how the store holds it.
  const waitForAttachment = async (title: string, renderType: string) => {
    const ordinal = await waitForRow(title, 60_000)
    const a = await waitFor(
      `the attachment "${title}" to be ready`,
      async () => {
        const got = await storedAttachment(ordinal)
        if (!got) throw new Error(`row ${ordinal} is not an attachment`)
        return got.renderType === renderType && got.id > 0 && !got.transferState && (renderType === 'attachment:file' || got.hasPreview)
          ? got
          : undefined
      },
      {interval: 500, timeout: 60_000}
    )
    return {a, ordinal}
  }

  // An attachment sent by the second account, said without the name.
  const expectFromSecond = (a: StoredAttachment) => {
    check(a.author === loadE2EEnv().secondUser, 'the attachment did not come from the second account')
  }

  // Taps `button` and checks the fullscreen view that opens is the attachment's, then goes back.
  const openFullscreen = async (button: WebdriverIO.Element, a: StoredAttachment, what: string) => {
    await button.click()
    await el(T.CHAT_ATTACHMENT_FULLSCREEN).waitForExist({timeout: 10_000})
    const {screen} = await appSnapshot()
    check(screen?.name === 'chatAttachmentFullscreen' && screen.params?.['messageID'] === a.id, `the fullscreen view is not the ${what}`)
    await step(`The ${what} fullscreen`)
    await goBackUntilGone(T.CHAT_ATTACHMENT_FULLSCREEN)
    await el(T.CHAT_ATTACHMENT_FULLSCREEN).waitForExist({reverse: true, timeout: 5_000})
  }

  // Sends a conversation command (it posts no message) from the composer, and waits for it to leave
  // the composer.
  const sendCommand = async (command: string) => {
    await typeInComposer(command)
    await el(T.CHAT_SEND_BUTTON).waitForExist({timeout: 5_000})
    await el(T.CHAT_SEND_BUTTON).click()
    await waitForComposerText('', 10_000)
    await hideKeyboard()
  }

  // An attachment's row by its title in the open thread, once it is loaded, collapsed or not.
  const loadedAttachment = async (title: string) => {
    const ordinal = await waitForRow(title, 20_000)
    return waitFor(`the attachment "${title}"`, async () => (await storedAttachment(ordinal)) ?? undefined, {
      interval: 500,
      timeout: 10_000,
    })
  }

  // The titles of the attachments the host reads in the throwaway channel, polled until `ok` takes them.
  const expectHostTitles = async (what: string, ok: (titles: Array<string>) => boolean) => {
    const titles = (ms: Array<CliMessage>) =>
      ms.filter(m => m.content.type === 'attachment').map(m => m.content.attachment?.object?.title ?? '')
    await expectCli({topicName: topicName()}, what, ms => ok(titles(ms)))
  }

  it('an image the second account attaches shows inline and opens fullscreen', async function () {
    // worst case (s): peer 70, attach 60, open 100, landed 120, the check 1, view 30, in row 2, step
    // 2, full 26, step 2 = 413
    this.timeout(440_000)
    const title = e2eMarker('attach-image')
    await attachIncoming('e2e-c.png', title)
    await openConversation(convID())
    const {a, ordinal} = await waitForAttachment(title, 'attachment:image')
    expectFromSecond(a)
    await scrollRowIntoView(ordinal)
    const image = await elementInRow(`~${T.CHAT_ATTACHMENT_IMAGE}`, ordinal, 'the inline image')
    await step('The incoming image inline')
    await openFullscreen(image, a, 'image')
    await step('Back in the thread from the image', {card: true})
  })

  it('a video the second account attaches shows inline and its corner button opens it fullscreen', async function () {
    // worst case (s): peer 70, attach 60, open 100, landed 120, the check 1, view 30, the button 15
    // (videoFullscreenButton), step 2, full 26, step 2 = 426
    this.timeout(440_000)
    const title = e2eMarker('attach-video')
    await attachIncoming('e2e-c.mp4', title)
    await openConversation(convID())
    const {a, ordinal} = await waitForAttachment(title, 'attachment:video')
    expectFromSecond(a)
    await scrollRowIntoView(ordinal)
    const corner = await videoFullscreenButton(title, ordinal)
    await step('The incoming video playing inline, with its corner button')
    await openFullscreen(corner, a, 'video')
    await step('Back in the thread from the video', {card: true})
  })

  // The phone has no collapse control on an attachment (desktop's caret is desktop-only); /collapse
  // collapses every inline preview in the conversation up to then, and a collapsed one's "Collapsed"
  // expands it. The phone's own service keeps both: a relaunch shows the one expanded from its row
  // still expanded and the other still collapsed.
  it('/collapse collapses the images, one expands from its row, and both stay so through a relaunch', async function () {
    // worst case (s): peer 70, two attaches 120, open 100, two landed 240, the command 35 (type 15,
    // the button 5, the tap 1, composer 10, keyboard 5, overrun 1), the collapse 20, step 2, calls 2,
    // view 30, three tries of (stable 10, in row 2, the tap 5, the expand 5) = 66, calls 10, the image
    // 2, step 2, relaunch 200, signed in 90, open 100, the two reads 60 (each row 20 and its attachment
    // 10), step 2 = 1151
    this.timeout(1200_000)
    const expanded = e2eMarker('attach-expand')
    const kept = e2eMarker('attach-kept')
    await attachIncoming('e2e-c.png', expanded)
    await attachIncoming('e2e-c.jpg', kept)
    await openConversation(convID())
    const {ordinal: expandOrdinal} = await waitForAttachment(expanded, 'attachment:image')
    const {ordinal: keptOrdinal} = await waitForAttachment(kept, 'attachment:image')

    // /collapse is the conversation's own command: the service collapses and the thread reloads
    await sendCommand('/collapse')
    const collapsed = async () => [(await storedAttachment(expandOrdinal))?.collapsed, (await storedAttachment(keptOrdinal))?.collapsed]
    await waitFor('both images to show collapsed', async () => ((await collapsed()).every(c => c === true) ? true : undefined), {
      interval: 500,
      timeout: 20_000,
    })
    await step('After /collapse both images show collapsed')

    const before = await currentCallSeq()
    await scrollRowIntoView(expandOrdinal)
    // A tap while the thread still redraws after /collapse can land on a row being replaced and do
    // nothing; it is tapped again only while the image still reads collapsed, so a late first tap is
    // never undone by a second.
    const expandedNow = async () => (await storedAttachment(expandOrdinal))?.collapsed === false
    for (let tap = 1; ; tap++) {
      await waitForThreadStable()
      const label = await elementInRow(`-ios predicate string:label == "Collapsed" AND visible == 1`, expandOrdinal, 'the "Collapsed" label')
      await tapTextIn(label, expandOrdinal, 'Collapsed')
      const expanded = await waitFor('the image to expand', async () => ((await expandedNow()) ? true : undefined), {
        interval: 250,
        timeout: 5_000,
      }).catch((e: unknown) => {
        if (isAttemptOver(e)) throw e
        return false
      })
      if (expanded) break
      if (tap >= 3) throw new Error('the image did not expand after three taps on its "Collapsed" label')
    }
    await waitForUiCall('the expand to go out', before, 'chat.1.local.toggleMessageCollapse')
    await elementInRow(`~${T.CHAT_ATTACHMENT_IMAGE}`, expandOrdinal, 'the expanded image')
    await step('The image expanded from its row, the other still collapsed')

    // read afresh after the relaunch: the rows' ordinals are the new runtime's
    const read = async () => {
      await openConversation(convID())
      const state = async (title: string) => ((await loadedAttachment(title)).collapsed ? 'collapsed' : 'expanded')
      return {expanded: await state(expanded), kept: await state(kept)}
    }
    await expectPersists('the two images', read, {expanded: 'expanded', kept: 'collapsed'})
    creditSurface('relaunch')
    await step('After a relaunch the expanded image is still expanded and the other still collapsed', {card: true})
  })

  // The account's own attachment from another device (the host), deleted from the phone's menu.
  it("the account's own file attached from another device is deleted from its menu, and the host no longer has it", async function () {
    // worst case (s): host 60, open 100, landed 120, the check 1, cli 80, view 30, keyboard 5, menu 35,
    // step 2 (before the item), the row gone 20, cli 80, step 2 = 535
    this.timeout(560_000)
    const title = e2eMarker('attach-file')
    await attachToThrowawayFromCli(topicName(), corpusEntry('e2e-c.txt').file, title)
    await openConversation(convID())
    const {a, ordinal} = await waitForAttachment(title, 'attachment:file')
    check(a.author === loadE2EEnv().smokeUser, "the file is not the account's own")
    await expectHostTitles('the file', titles => titles.includes(title))
    await scrollRowIntoView(ordinal)
    await hideKeyboard()
    await openMessageMenu(title)
    await step("The menu of the account's own file")
    await chooseMenuItem('Delete for everyone')
    await waitFor('the file row to go', async () => ((await deletePhase(ordinal)) === 'gone' ? true : undefined), {
      interval: 250,
      timeout: 20_000,
    })
    check(!(await ordinalsWithText(title)).length, 'the deleted file is back in the thread')
    await expectHostTitles('the file gone', titles => !titles.includes(title))
    await step('The file deleted: gone from the thread and from the host', {card: true})
  })

  it("the info panel's Media lists the incoming image and video, and Docs the file", async function () {
    // worst case (s): peer 70, two attaches 120, host 60, open 100, three landed 360, the panel 35,
    // media 30, step 2, docs 30, its title 5, step 2, the back 10, gone 5 = 829
    this.timeout(860_000)
    const image = e2eMarker('attach-media-image')
    const video = e2eMarker('attach-media-video')
    const file = e2eMarker('attach-docs-file')
    await attachIncoming('e2e-c.jpg', image)
    await attachIncoming('e2e-c.mp4', video)
    await attachToThrowawayFromCli(topicName(), corpusEntry('e2e-c.txt').file, file)
    await openConversation(convID())
    const {a: imageA} = await waitForAttachment(image, 'attachment:image')
    const {a: videoA} = await waitForAttachment(video, 'attachment:video')
    const {a: fileA} = await waitForAttachment(file, 'attachment:file')

    await openHeaderMenuItem('Info', async () => el(T.CHAT_INFO_PANEL).isExisting())
    await el(T.CHAT_INFO_PANEL_ATTACHMENTS_TAB).waitForExist({timeout: 10_000})
    await el(T.CHAT_INFO_PANEL_ATTACHMENTS_TAB).click()
    await el(T.CHAT_INFO_PANEL_MEDIA).waitForExist({timeout: 10_000})
    await el(T.CHAT_INFO_PANEL_MEDIA).click()
    await waitFor(
      'Media to list the image and the video',
      async () => {
        const {media} = await galleryListing()
        const has = (id: number, video: boolean) => media.some(m => m.id === id && m.video === video)
        return has(imageA.id, false) && has(videoA.id, true) ? true : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    await step('Media lists the incoming image and video')

    await el(T.CHAT_INFO_PANEL_DOCS).click()
    await waitFor(
      'Docs to list the file',
      async () => ((await galleryListing()).docs.some(d => d.id === fileA.id && d.name === file) ? true : undefined),
      {interval: 500, timeout: 20_000}
    )
    // the row is one element whose label starts with the title, then the file name and the sender
    await browser
      .$(`-ios predicate string:(label == ${JSON.stringify(file)} OR label BEGINSWITH ${JSON.stringify(`${file},`)}) AND visible == 1`)
      .waitForExist({timeout: 5_000, timeoutMsg: "the file's row does not show its title"})
    await step('Docs lists the file by its title', {card: true})
    await closeInfoPanel()
  })
})
