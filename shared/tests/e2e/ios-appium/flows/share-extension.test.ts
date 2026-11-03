// The share extension, one source per test, each sent on to the smoke account's self conversation
// and read back on the host: a corpus photo from Photos, text selected in Safari (a page of this run
// served on the loopback interface), the corpus pdf from a folder of this run in Files, a place from
// Maps, and a second share made while the first sits unsent on the app's share screen, which must
// take its place. Then an image pasted into the composer: a corpus photo copied in Photos.
//
// What the extension handed over is read from its app group (the manifest it writes into
// incoming-shares, gate/share.ts) before the app's own screens are trusted; 'share-extension' is
// credited once the app's titles screen or composer holds exactly that. Every share starts from the
// open self conversation: with none open, the share screen can be taken down by an inbox update
// before a conversation is picked.
//
// The afterEach closes the apps shared from, leaves the app's share screen by its Cancel, removes
// this run's payload folders from incoming-shares (a failure poisons the gate) and the seed folder,
// puts other text on the pasteboard after the image paste, and deletes the Maps test's message (its
// text starts with the link, so the sweeper would not know it as this run's).
import {loadE2EAccounts} from '../../accounts/env'
import {corpusEntry} from '../../fixtures/corpus/corpus'
import {deleteFromCli, readFromCli, type CliMessage} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {e2eMarker} from '../../shared/run-marker'
import {unfurlSettings} from '../../shared/settings'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {FILES_APP, imageProps, pastedImage, pasteboardText, removeSeedFolder, seedDocumentFolder, setPasteboard} from '../gate/device'
import {APPLE_PARK} from '../gate/location-lib.ts'
import {guarded} from '../gate/poison-lib.ts'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {
  copyPhoto,
  filesSheet,
  leaveSharePicker,
  leaveShareHosts,
  MAPS,
  mapsSheet,
  photosSheet,
  PHOTOS,
  pickSelfInSharePicker,
  removeSharePayloads,
  requireExtensionLogClean,
  SAFARI,
  safariTextSheet,
  shareToKeybase,
  startPageServer,
} from '../gate/share'
import {extensionRequests, mapsShareProblem, requireOneItem, textPage, unfurlFetchProblem, type ManifestItem} from '../gate/share-lib.ts'
import {step} from '../gate/step'
import {composerText, fileSha, hostCopy, pasteIntoComposer} from '../helpers/chat'
import {el} from '../helpers/elements'
import {fillHiddenField, tapButton} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {openSelfConversation, waitFor} from '../helpers/lifecycle'
import {check} from '../helpers/menus'

const POST_ATTACHMENT = 'chat.1.local.postFileAttachmentLocalNonblock'
const POST_TEXT = 'chat.1.local.postTextNonblock'
const PASTEBOARD = 'the share flow\'s pasteboard overwrite'

const localPath = (p: string) => (p.startsWith('file://') ? p.slice('file://'.length) : p)

describe('share extension', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   self      openSelfConversation 110;  empty  the composer read 1
  //   share     shareToKeybase 451 and its sheet:  photos  42;  safari  174;  files  290;  maps  168
  //   log       the log check 0
  //   picker    pickSelfInSharePicker 86
  //   titles    expectScreen 31;  pixels  sips 15 each;  sha  1;  pasted  the container read 120
  //   aim       the screen read before a Send 11 (10, one read 1)
  //   caption   fillHiddenField 30;  send  tapButton 6;  calls  waitForUiCall 10
  //   text      the composer 10 of reads;  sent  the send button 5 and its tap 1
  //   cli       the host read polled 60, overrun by one read's 60 = 120;  download  60
  //   seed      seedDocumentFolder 121;  copy  copyPhoto 47;  paste  pasteIntoComposer 21
  //   unfurl    the host read 60
  //   step      2 (its 1s settle and the attach)
  //   cleanup   leaveShareHosts 6, leaveSharePicker 17, the payloads 120, the seed 120, the pasteboard
  //             80 (its write 50, the read again 30), the page server 1, the Maps message 180 (the
  //             read 60, its delete 60, the read back 60) = 524

  let seeded: string | undefined
  let pasted = false
  // the Maps test's place: the message it sends starts with the link, not the run stamp the sweeper
  // finds, so the afterEach deletes the message holding it
  let mapsPlace: string | undefined
  let server: Awaited<ReturnType<typeof startPageServer>> | undefined

  // Worst case (s): 524.
  afterEach(async function () {
    this.timeout(540_000)
    await withCleanup(leaveShareHosts, [
      leaveSharePicker,
      removeSharePayloads,
      async () => {
        if (!seeded) return
        await removeSeedFolder(seeded)
        seeded = undefined
      },
      async () => {
        if (!pasted) return
        // an overwrite that did not finish poisons the gate unless the pasteboard reads back the text
        const over = e2eMarker('share-paste-over')
        await guarded(
          PASTEBOARD,
          "copy any text on the simulator, over the corpus image the share flow's paste left on its pasteboard",
          async () => setPasteboard(over),
          async () => (await pasteboardText()) !== over
        )
        pasted = false
      },
      () => {
        server?.close()
        server = undefined
      },
      deleteMapsMessage,
    ])
  })

  // -- helpers --------------------------------------------------------------------------------------

  // Deletes the Maps test's message (found on the host as smoke's text holding the test's place on a
  // line of its own, so a Send whose read-back failed is found too) and reads it back gone. Bound:
  // the read 60, the delete 60 (one message: the place is the test's own marker), the read back 60 =
  // 180.
  const deleteMapsMessage = async () => {
    if (mapsPlace === undefined) return
    const place = mapsPlace
    const {smokeUser} = loadE2EAccounts()
    const holding = async () =>
      (await readFromCli({tlfName: smokeUser}, 30)).filter(m => m.content.type === 'text' && (m.content.text?.body ?? '').split('\n').includes(place))
    for (const m of await holding()) await deleteFromCli({tlfName: smokeUser}, m.id)
    if ((await holding()).length) throw new Error("the Maps test's message is still in the self conversation after its delete")
    mapsPlace = undefined
  }

  // Opens the self conversation and reads its composer empty (a shared text goes after a draft).
  // Bound: self 110, empty 1 = 111.
  const fromSelf = async (smokeUser: string) => {
    const convID = await openSelfConversation(smokeUser)
    check((await composerText()) === '', 'the self conversation holds a draft: a shared text would go after it')
    return convID
  }

  // The titles screen for the self conversation holding the one shared file `item`. Bound: titles 31.
  const titlesWith = async (convID: string, item: ManifestItem) => {
    const s = await expectScreen(
      'the titles screen for the self conversation',
      'chatAttachmentGetTitles',
      p => p['conversationIDKey'] === convID && Array.isArray(p['pathAndOutboxIDs']) && p['pathAndOutboxIDs'].length === 1,
      30_000
    )
    const [first] = s.params?.['pathAndOutboxIDs'] as Array<{path: string}>
    check(!!first && localPath(first.path) === item.originalPath, 'the titles screen does not hold the file the share extension handed over')
    return localPath(first!.path)
  }

  // Captions the one attachment `title`, sends it once the screen up reads as the titles screen for
  // the self conversation `convID`, and reads it back on the host by that title. Bound: caption 30,
  // aim 11, send 6, calls 10, cli 120 = 177.
  const sendTitled = async (smokeUser: string, convID: string, title: string) => {
    await fillHiddenField(T.CHAT_ATTACHMENT_CAPTION, title, 'the caption')
    await expectScreen('the titles screen for the self conversation, before Send', 'chatAttachmentGetTitles', p => p['conversationIDKey'] === convID)
    const seq = await currentCallSeq()
    await tapButton('Send', "the titles screen's Send")
    await waitForUiCall('the attachment to go out', seq, POST_ATTACHMENT)
    return waitFor(
      'the host to read the attachment by its title',
      async () => {
        const found = (await readFromCli({tlfName: smokeUser}, 30)).filter(
          m => m.content.type === 'attachment' && m.content.attachment?.object?.title === title
        )
        if (found.length > 1) throw new Error(`${found.length} attachments carry the title, not one`)
        return found[0]
      },
      {interval: 2_000, timeout: 60_000}
    )
  }

  // Sends what the composer holds, which must be `text` exactly, once the screen up reads as the self
  // conversation `convID` (the picker's row is matched by its label alone), and reads it back on the
  // host. Bound: text 10, aim 11, sent 6, calls 10, cli 120 = 157.
  const sendComposed = async (smokeUser: string, convID: string, text: string) => {
    await waitFor('the composer to hold the shared text', async () => ((await composerText()) === text ? true : undefined), {
      interval: 500,
      timeout: 10_000,
    })
    await expectScreen('the self conversation, before Send', 'chatConversation', p => p['conversationIDKey'] === convID)
    const seq = await currentCallSeq()
    await el(T.CHAT_SEND_BUTTON).waitForExist({timeout: 5_000})
    await el(T.CHAT_SEND_BUTTON).click()
    await waitForUiCall('the text to go out', seq, POST_TEXT)
    await waitFor(
      'the host to read the shared text',
      async () => {
        const n = (await readFromCli({tlfName: smokeUser}, 30)).filter(m => m.content.type === 'text' && m.content.text?.body === text).length
        if (n > 1) throw new Error(`${n} messages hold the shared text, not one`)
        return n === 1 ? true : undefined
      },
      {interval: 2_000, timeout: 60_000}
    )
  }

  // The image attachment `m` reads, on the host, as the corpus png's pixel size. Bound: download 60,
  // sips 15 x 2 = 90.
  const requirePngSized = async (smokeUser: string, m: CliMessage) => {
    check((m.content.attachment?.object?.mimeType ?? '').startsWith('image/'), 'the photo went out as something other than an image')
    const want = imageProps(corpusEntry('e2e-c.png').file).pixels
    check((await hostCopy(smokeUser, m, f => imageProps(f).pixels)) === want, "the host's image is not the corpus png's pixel size")
  }

  // -- tests ----------------------------------------------------------------------------------------

  it('a corpus photo shared from Photos is sent to the self conversation', async function () {
    // worst case (s): self 111, share 451, photos 42, log 0, step 2, picker 86, titles 31, pixels 30,
    // step 2, send 177, the image 90, step 2 = 1024
    this.timeout(1_040_000)
    const {smokeUser} = loadE2EAccounts()
    const convID = await fromSelf(smokeUser)
    const shared = await shareToKeybase(PHOTOS, photosSheet('e2e-c.png'))
    const item = requireOneItem(shared, {type: 'image'})
    requireExtensionLogClean(shared.log)
    await step("The app's share screen for the photo", {screenshot: false})
    await pickSelfInSharePicker(smokeUser)
    const file = await titlesWith(convID, item)
    // the extension applies the compress preference itself: a copy of the photo, at its pixel size
    check(imageProps(file).pixels === imageProps(corpusEntry('e2e-c.png').file).pixels, "the shared photo is not the corpus png's pixel size")
    creditSurface('share-extension')
    await step('The titles screen with the shared photo')
    const sent = await sendTitled(smokeUser, convID, e2eMarker('share-photos'))
    await requirePngSized(smokeUser, sent!)
    await step('The shared photo sent to the self conversation', {card: true})
  })

  it('text selected in Safari is sent to the self conversation', async function () {
    // worst case (s): self 111, the page 1, share 451, safari 174, log 0, step 2, picker 86, the
    // composer 10, text 157, step 2 = 994
    this.timeout(1_010_000)
    const {smokeUser} = loadE2EAccounts()
    const text = e2eMarker('share-safari')
    const page = `${e2eMarker('share-page')}.html`
    server = await startPageServer(new Map([[page, textPage('shared text', text)]]))
    const convID = await fromSelf(smokeUser)
    const since = server.requests.length
    const shared = await shareToKeybase(SAFARI, safariTextSheet(`${server.origin}/${page}`, 'shared text'))
    requireOneItem(shared, {content: text, type: 'text'})
    requireExtensionLogClean(shared.log)
    // selected text is the text itself: the extension fetches nothing
    check(!extensionRequests(server.requests, since).length, 'the share extension fetched from the page server')
    await step("The app's share screen for the text", {screenshot: false})
    await pickSelfInSharePicker(smokeUser)
    // text goes into the conversation's composer, with no titles screen
    await waitFor('the composer to hold the shared text', async () => ((await composerText()) === text ? true : undefined), {
      interval: 500,
      timeout: 10_000,
    })
    creditSurface('share-extension')
    await sendComposed(smokeUser, convID, text)
    await step('The shared text sent to the self conversation', {card: true})
  })

  it('the corpus pdf shared from a folder in Files is sent to the self conversation', async function () {
    // worst case (s): seed 121, self 111, share 451, files 290, log 0, step 2, picker 86, titles 31,
    // sha 1, step 2, send 177, download 60, step 2 = 1334
    this.timeout(1_350_000)
    const {smokeUser} = loadE2EAccounts()
    const pdf = corpusEntry('e2e-c.pdf').file
    seeded = seedDocumentFolder('share', ['e2e-c.pdf'])
    const convID = await fromSelf(smokeUser)
    const shared = await shareToKeybase(FILES_APP, filesSheet(seeded, 'e2e-c.pdf'))
    const item = requireOneItem(shared, {ext: '.pdf', type: 'file'})
    requireExtensionLogClean(shared.log)
    await step("The app's share screen for the pdf", {screenshot: false})
    await pickSelfInSharePicker(smokeUser)
    const file = await titlesWith(convID, item)
    check(fileSha(file) === fileSha(pdf), 'the shared file is not the corpus pdf')
    creditSurface('share-extension')
    await step('The titles screen with the shared pdf')
    const sent = await sendTitled(smokeUser, convID, e2eMarker('share-files'))
    check((await hostCopy(smokeUser, sent!, fileSha)) === fileSha(pdf), "the host's attachment is not the corpus pdf")
    await step('The shared pdf sent to the self conversation', {card: true})
  })

  it('a place shared from Maps is sent to the self conversation', async function () {
    // worst case (s): self 111, share 451, maps 168, log 0, unfurl 60, step 2, picker 86, the composer
    // 10, text 157, step 2 = 1047
    this.timeout(1_060_000)
    const {smokeUser} = loadE2EAccounts()
    const place = e2eMarker('share-maps')
    const convID = await fromSelf(smokeUser)
    const shared = await shareToKeybase(MAPS, mapsSheet(APPLE_PARK.lat, APPLE_PARK.lon, place))
    const item = requireOneItem(shared, {type: 'text'})
    requireExtensionLogClean(shared.log)
    const text = item.content ?? ''
    const problem = mapsShareProblem(text, place)
    if (problem) throw new Error(problem)
    // the share holds an Apple Maps link: sent only if the phone's service would not fetch it
    const linkProblem = unfurlFetchProblem(await unfurlSettings(), text)
    if (linkProblem) throw new Error(linkProblem)
    await step("The app's share screen for the place", {screenshot: false})
    await pickSelfInSharePicker(smokeUser)
    await waitFor('the composer to hold the shared place', async () => ((await composerText()) === text ? true : undefined), {
      interval: 500,
      timeout: 10_000,
    })
    creditSurface('share-extension')
    mapsPlace = place
    await sendComposed(smokeUser, convID, text)
    await step('The shared place sent to the self conversation', {card: true})
  })

  it('a second share made while the first is unsent replaces it on the share screen', async function () {
    // worst case (s): self 111, two shares 902 and two photos sheets 84, log 0, the first screen 31,
    // step 2, picker 86, titles 31, pixels 30, step 2, send 177, the image 90, step 2 = 1548
    this.timeout(1_570_000)
    const {smokeUser} = loadE2EAccounts()
    const convID = await fromSelf(smokeUser)
    const first = requireOneItem(await shareToKeybase(PHOTOS, photosSheet('e2e-c.jpg')), {type: 'image'})
    await expectScreen("the app's share screen for the first share", 'incomingShareNew', () => true, 30_000)
    await step('The first share left unsent', {screenshot: false})
    const shared = await shareToKeybase(PHOTOS, photosSheet('e2e-c.png'))
    const second = requireOneItem(shared, {type: 'image'})
    requireExtensionLogClean(shared.log)
    check(second.originalPath !== first.originalPath, 'the two shares handed over one file')
    await pickSelfInSharePicker(smokeUser)
    // the titles screen holds the second share's file alone, not the first's
    const file = await titlesWith(convID, second)
    check(imageProps(file).pixels === imageProps(corpusEntry('e2e-c.png').file).pixels, "the second share's photo is not the corpus png's pixel size")
    creditSurface('share-extension')
    await step("The titles screen with the second share's photo")
    const sent = await sendTitled(smokeUser, convID, e2eMarker('share-replaced'))
    await requirePngSized(smokeUser, sent!)
    await step('The second share sent to the self conversation', {card: true})
  })

  it('a photo copied in Photos and pasted into the composer is sent to the self conversation', async function () {
    // worst case (s): copy 47, self 111, paste 21, titles 31, pasted 120, pixels 30, step 2, send 177,
    // the image 90, step 2 = 631
    this.timeout(650_000)
    const {smokeUser} = loadE2EAccounts()
    pasted = true
    await copyPhoto('e2e-c.png')
    const convID = await fromSelf(smokeUser)
    await pasteIntoComposer()
    // the app's paste (Kb.mm) writes the pasteboard's image to its tmp dir and opens the titles screen
    const s = await expectScreen(
      'the titles screen for the pasted image',
      'chatAttachmentGetTitles',
      p => p['conversationIDKey'] === convID && Array.isArray(p['pathAndOutboxIDs']) && p['pathAndOutboxIDs'].length === 1,
      30_000
    )
    const [first] = s.params?.['pathAndOutboxIDs'] as Array<{path: string}>
    const image = pastedImage(first!.path)
    check(imageProps(image.path).pixels === imageProps(corpusEntry('e2e-c.png').file).pixels, "the pasted image is not the corpus png's pixel size")
    creditSurface('pasteboard')
    await step('The titles screen with the pasted image')
    const sent = await sendTitled(smokeUser, convID, e2eMarker('share-paste'))
    await requirePngSized(smokeUser, sent!)
    await step('The pasted image sent to the self conversation', {card: true})
  })
})
