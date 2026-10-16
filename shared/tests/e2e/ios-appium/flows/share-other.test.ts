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

  it('a contact card', async function () {
    addMedia(this, 'contact.vcf')
    await runSource(
      'contacts-card',
      {host: CONTACTS, open: shareContactSheet('Share Matrix')},
      {items: [{content: /Share Matrix[\s\S]*share-matrix@example\.com/, type: 'text'}]}
    )
  })

  it('a Maps location', async () => {
    await runSource(
      'maps-location',
      {host: MAPS, open: shareMapsPinSheet(37.3349, -122.009, 'Share Matrix')},
      {items: [{content: /maps\.apple\.com|maps\.apple/, type: 'text'}]}
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
    await runSource('photos-unsent-second', {host: PHOTOS, open: sharePhotosSheet(1)}, {items: [{name: /^photo-e\.png$/i, type: 'image'}]})
  })
})
