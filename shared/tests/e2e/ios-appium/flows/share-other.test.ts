// Share-source matrix: text, Contacts, Maps, the share sheet's suggested conversation, and a share
// that replaces one the user never sent.
import {
  CONTACTS,
  MAPS,
  PHOTOS,
  SAFARI,
  addMedia,
  exists,
  inApp,
  runSource,
  smokeUser,
  shareContactSheet,
  shareMapsPinSheet,
  sharePhotosSheet,
  shareSafariElementSheet,
  shareScreenLifetime,
  shareToKeybase,
  skipSource,
  startAssetServer,
  suggestionRow,
} from '../helpers/share'

describe('Share text and other sources', () => {
  let server: Awaited<ReturnType<typeof startAssetServer>> | undefined
  before(async () => {
    server = await startAssetServer()
  })
  after(() => {
    server?.close()
  })

  it('plain text from Notes', function () {
    skipSource(this, 'Notes is not installed on the simulator; the next source shares plain text from Safari')
  })

  it('plain text selected in Safari', async () => {
    await runSource(
      'safari-plain-text',
      {host: SAFARI, open: shareSafariElementSheet(`${server!.origin}/text.html`, 'plain text', {selectAll: true})},
      {items: [{content: /^Share matrix plain text$/, type: 'text'}]}
    )
  })

  it('text containing a URL, selected in Safari', async () => {
    await runSource(
      'safari-text-with-url',
      {host: SAFARI, open: shareSafariElementSheet(`${server!.origin}/text.html`, 'url text', {selectAll: true})},
      {items: [{content: /^Share matrix link https:\/\/keybase\.io\/docs here$/, type: 'text'}]}
    )
  })

  // Under chat's 10000-byte limit, long text is still one message.
  it('long text selected in Safari', async () => {
    await runSource(
      'safari-long-text',
      {host: SAFARI, open: shareSafariElementSheet(`${server!.origin}/text.html`, 'long text', {selectAll: true})},
      {items: [{content: /^Share matrix long text (word ){399}word$/, type: 'text'}]}
    )
  })

  // Over the limit it is attached as a .txt named after its first words.
  it('text over the message limit selected in Safari', async () => {
    await runSource(
      'safari-huge-text',
      {host: SAFARI, open: shareSafariElementSheet(`${server!.origin}/text.html`, 'huge text', {selectAll: true})},
      {
        delivered: [{name: /^Share matrix huge text word word\.txt$/, type: 'file'}],
        items: [{name: /^Share matrix huge text word word\.txt$/, type: 'text'}],
      }
    )
  })

  // Whitespace isn't something to share: the extension says it couldn't prepare the item and never
  // opens the app. Its process can outlive the share (the alert alone stays up about 10s), so the
  // log line is the sign it finished, not the process going away.
  it('whitespace-only text selected in Safari', async () => {
    const share = await shareToKeybase(
      {host: SAFARI, open: shareSafariElementSheet(`${server!.origin}/text.html`, 'blank text', {selectAll: true})},
      {timeout: 25_000}
    )
    const problems = [
      ...(share.appOpened ? ['the app opened for a whitespace-only share'] : []),
      ...(share.manifest?.some(m => !m.error) ? [`the manifest has items: ${JSON.stringify(share.manifest)}`] : []),
      ...(share.extLog.some(l => l.includes('share failed: none of')) ? [] : ['the extension never logged the failed share']),
    ]
    if (problems.length) throw new Error(problems.join('\n'))
  })

  it('a contact card', async function () {
    addMedia(this, 'contact.vcf')
    await runSource(
      'contacts-card',
      {host: CONTACTS, open: shareContactSheet('Share Matrix')},
      {items: [{content: /Share Matrix[\s\S]*share-matrix@example\.com/, type: 'text'}]}
    )
  })

  // Maps shares the place's card and its link: the place's name comes along with the link.
  it('a Maps location', async () => {
    await runSource(
      'maps-location',
      {host: MAPS, open: shareMapsPinSheet(37.3349, -122.009, 'Share Matrix')},
      {items: [{content: /^(?=[\s\S]*Share Matrix)(?=[\s\S]*maps\.apple)/, type: 'text'}]}
    )
  })

  it('a Messages or Mail attachment', function () {
    skipSource(this, 'Mail is not installed on the simulator and Messages has no account to receive attachments')
  })

  // A suggested conversation goes straight to the send screen for it, skipping the picker.
  it("the share sheet's suggested self conversation", async function () {
    const user = smokeUser()
    addMedia(this, 'photo-c.png')
    const shown = await inApp(PHOTOS, async () => {
      await sharePhotosSheet(1)()
      return exists(suggestionRow(user), 5000)
    })
    if (!shown) skipSource(this, 'the share sheet shows no suggestion row for the self conversation')
    await runSource(
      'sheet-suggested-conversation',
      {host: PHOTOS, open: sharePhotosSheet(1)},
      {items: [{name: /^photo-c\.png$/i, type: 'image'}]},
      {suggested: true, target: suggestionRow(user)}
    )
  })

  // The share screen must stay up while the user picks a conversation, however long that takes.
  it('the share screen stays up over the inbox', async function () {
    addMedia(this, 'photo-b.png')
    await shareScreenLifetime({host: PHOTOS, open: sharePhotosSheet(1)}, 30)
  })

  // The first share is left on the app's share screen; the second must replace it.
  it('a second share while the first is still unsent', async function () {
    addMedia(this, 'photo-d.png')
    await runSource('photos-unsent-first', {host: PHOTOS, open: sharePhotosSheet(1)}, {items: [{name: /^photo-d\.png$/i, type: 'image'}]}, {
      keepShareScreen: true,
    })
    addMedia(this, 'photo-e.png')
    await runSource(
      'photos-unsent-second',
      {host: PHOTOS, open: sharePhotosSheet(1)},
      {items: [{name: /^photo-e\.png$/i, type: 'image'}]},
      {overShareScreen: true}
    )
  })
})
