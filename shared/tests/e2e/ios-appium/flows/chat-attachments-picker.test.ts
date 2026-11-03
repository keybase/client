// The phone's own attachments, picked in the system pickers from the composer's camera button and
// sent to the smoke account's self conversation: a png and an mp4 of the photo corpus from "Choose
// from library" (the photo picker), and the corpus pdf from "Choose a file" (the document picker,
// from a folder of this run seeded in On My iPhone). Each pick is proven by the files the titles
// screen holds (their sha256 is the corpus item's) before 'photo-picker' / 'file-picker' is credited;
// each sent attachment is read back on the host by its stamped title.
//
// The photo corpus is in the simulator's library once (gate/device.ts ensurePhotoCorpus). The flow's
// afterEach closes a picker a test left up and removes the seed folder.
import * as fs from 'fs'
import {loadE2EAccounts} from '../../accounts/env'
import {corpusEntry} from '../../fixtures/corpus/corpus'
import {readFromCli, type CliMessage} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {ensurePhotoCorpus, imageProps, pickedFiles, removeSeedFolder, seedDocumentFolder} from '../gate/device'
import {requirePicked, type LibraryName} from '../gate/picker-lib.ts'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {closeSystemPickers, pickDocument, pickFromLibrary} from '../gate/system-ui'
import {fileSha, hostCopy} from '../helpers/chat'
import {el} from '../helpers/elements'
import {fillHiddenField, pressTestID, tapButton} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {openSelfConversation, waitFor} from '../helpers/lifecycle'
import {check, openMenuFrom} from '../helpers/menus'

const POST_ATTACHMENT = 'chat.1.local.postFileAttachmentLocalNonblock'



describe('chat attachments picked on the phone', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   self      openSelfConversation 110 (escapeToTabs 30, the Chat tab 15, the inbox read 30, the
  //             screen 20, the composer 10, the tab bar 5)
  //   corpus    ensurePhotoCorpus: one addmedia each when missing, 7 x 120 = 840 (0 once recorded)
  //   sheet     openMenuFrom 15;  row  pressTestID 12
  //   library   pickFromLibrary 65 + 1 per item
  //   document  pickDocument 100;  seed  121 (its container lookup 120)
  //   titles    expectScreen 11;  picked  the container read 120 and the reads 1
  //   caption   fillHiddenField 30;  next  tapButton 6;  send  tapButton 6;  calls  waitForUiCall 10
  //   cli       the host read polled 60, overrun by one read's 60 = 120;  download  60 each
  //   pixels    imageProps 15 each
  //   step      2 (its 1s settle and the attach)
  //   cleanup   closeSystemPickers 45, the seed removal 120 (its container lookup) = 165

  // the seed folder a test made in On My iPhone, cleared once removed
  let seeded: string | undefined

  // Worst case (s): 165.
  afterEach(async function () {
    this.timeout(180_000)
    await withCleanup(closeSystemPickers, [
      async () => {
        if (!seeded) return
        await removeSeedFolder(seeded)
        seeded = undefined
      },
    ])
  })

  // The titles screen for the self conversation, opened by a pick, and the files it holds. Bound:
  // the screen 11, the container read 120.
  const titlesScreen = async (convID: string, count: number, pickedAsFiles: boolean) => {
    const s = await expectScreen(
      'the titles screen for the self conversation',
      'chatAttachmentGetTitles',
      p =>
        p['conversationIDKey'] === convID &&
        Array.isArray(p['pathAndOutboxIDs']) &&
        p['pathAndOutboxIDs'].length === count &&
        !!p['pickedAsFiles'] === pickedAsFiles
    )
    const urls = (s.params?.['pathAndOutboxIDs'] as Array<{path: string}>).map(p => p.path)
    return pickedFiles(urls)
  }

  // The attachments the host reads in the self conversation under each of `titles`, exactly one each.
  // Bound: 60 of reads, overrun by one read's 60.
  const hostAttachments = async (smokeUser: string, titles: ReadonlyArray<string>) =>
    waitFor(
      'the host to read the attachments by their titles',
      async () => {
        const ms = (await readFromCli({tlfName: smokeUser}, 30)).filter(m => m.content.type === 'attachment')
        const out: Array<CliMessage> = []
        for (const t of titles) {
          const found = ms.filter(m => m.content.attachment?.object?.title === t)
          if (found.length > 1) throw new Error(`${found.length} attachments carry one title, not one`)
          if (!found[0]) return undefined
          out.push(found[0])
        }
        return out
      },
      {interval: 2_000, timeout: 60_000}
    )

  // Opens the composer's attach sheet in the self conversation and taps its row `rowID`. Bound: self
  // 110, sheet 15, step 2, row 12 = 139.
  const attachFrom = async (smokeUser: string, rowID: string) => {
    const convID = await openSelfConversation(smokeUser)
    await openMenuFrom('the attach sheet', async () => el(T.CHAT_CAMERA_BUTTON).click())
    await step('The attach sheet over the self conversation')
    await pressTestID(rowID, "the attach sheet's row")
    return convID
  }

  it('a png and an mp4 chosen from the library are sent with their captions', async function () {
    // worst case (s): corpus 840, attach 139, library 67, titles 131, step 2, two captions 60, next
    // 6, send 6, calls 10 x 2, cli 120, two downloads 120, two sips 30, step 2 = 1543
    this.timeout(1_560_000)
    const {smokeUser} = loadE2EAccounts()
    const names: Array<LibraryName> = ['e2e-c.png', 'e2e-c.mp4']
    const corpus = await ensurePhotoCorpus()
    const want = names.map(n => {
      const c = corpus.find(i => i.name === n)
      if (!c) throw new Error(`the photo corpus has no ${n}`)
      return c
    })
    const convID = await attachFrom(smokeUser, T.CHAT_ATTACH_LIBRARY)
    await pickFromLibrary(names)
    requirePicked(await titlesScreen(convID, names.length, false), want)
    creditSurface('photo-picker')
    await step('The titles screen with the two picked items')

    const titles = names.map(n => e2eMarker(`picker-${n.endsWith('.png') ? 'png' : 'mp4'}`))
    await fillHiddenField(T.CHAT_ATTACHMENT_CAPTION, titles[0]!, 'the first caption')
    await tapButton('Next', "the titles screen's Next")
    await fillHiddenField(T.CHAT_ATTACHMENT_CAPTION, titles[1]!, 'the second caption')
    const seq = await currentCallSeq()
    await tapButton('Send', "the titles screen's Send")
    await waitForUiCall('the first attachment to go out', seq, POST_ATTACHMENT)
    await waitFor('both attachments to go out', async () => ((await uiCallsSince(seq, POST_ATTACHMENT)).length >= 2 ? true : undefined), {
      interval: 500,
      timeout: 10_000,
    })
    // Send compresses what the library gave (the app's default): the png goes out as a jpeg of the
    // same pixel size, the mp4 re-encoded
    const [image, video] = await hostAttachments(smokeUser, titles)
    if (!image || !video) throw new Error('the host read fewer attachments than were sent')
    check((image.content.attachment?.object?.mimeType ?? '').startsWith('image/'), 'the png went out as something other than an image')
    check(
      (await hostCopy(smokeUser, image, f => imageProps(f).pixels)) === imageProps(want[0]!.file).pixels,
      "the host's image is not the png's pixel size"
    )
    check((video.content.attachment?.object?.mimeType ?? '').startsWith('video/'), 'the mp4 went out as something other than a video')
    check((await hostCopy(smokeUser, video, f => fs.statSync(f).size)) > 0, "the host's video is empty")
    await step('Both sent to the self conversation', {card: true})
  })

  it('a pdf chosen from a folder of the document picker is sent as a file', async function () {
    // worst case (s): seed 121, attach 139, document 100, titles 131, step 2, caption 30, send 6,
    // calls 10, cli 120, download 60, step 2 = 721
    this.timeout(740_000)
    const {smokeUser} = loadE2EAccounts()
    const pdf = corpusEntry('e2e-c.pdf')
    seeded = seedDocumentFolder('pick', [pdf.name])
    const convID = await attachFrom(smokeUser, T.CHAT_ATTACH_FILE)
    await pickDocument(seeded, pdf.name)
    const [picked] = await titlesScreen(convID, 1, true)
    requirePicked(picked ? [picked] : [], [{name: pdf.name, sha256: fileSha(pdf.file)}])
    creditSurface('file-picker')
    await step('The titles screen with the picked file')

    const title = e2eMarker('picker-pdf')
    await fillHiddenField(T.CHAT_ATTACHMENT_CAPTION, title, 'the caption')
    const seq = await currentCallSeq()
    await tapButton('Send', "the titles screen's Send")
    await waitForUiCall('the attachment to go out', seq, POST_ATTACHMENT)
    const [sent] = await hostAttachments(smokeUser, [title])
    if (!sent) throw new Error('the host read no attachment')
    check((await hostCopy(smokeUser, sent, fileSha)) === picked?.sha256, "the host's attachment is not the picked file")
    await step('The file sent to the self conversation', {card: true})
  })
})
