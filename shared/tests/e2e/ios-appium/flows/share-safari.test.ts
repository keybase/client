// Share-source matrix: Safari, against pages served from the host's loopback interface.
import {
  SAFARI,
  skipIfMissing,
  runSource,
  shareSafariElementSheet,
  shareSafariPageSheet,
  startAssetServer,
} from '../helpers/share'

describe('Share from Safari', () => {
  let server: Awaited<ReturnType<typeof startAssetServer>> | undefined
  const url = (name: string) => `${server!.origin}/${name}`

  before(async () => {
    server = await startAssetServer()
  })
  after(() => {
    server?.close()
  })

  it('the page URL from the toolbar', async () => {
    const page = url('index.html')
    const link = new RegExp(page.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
    await runSource('safari-page-url', {host: SAFARI, open: shareSafariPageSheet(page)}, {items: [{content: link, type: 'text'}]})
  })

  // Safari hands over the image's address; the extension downloads the image itself.
  it('a long-pressed image', async () => {
    await runSource(
      'safari-long-press-image',
      {host: SAFARI, open: shareSafariElementSheet(url('index.html'), 'matrix photo')},
      {items: [{name: /\.png$/i, type: 'image'}]}
    )
  })

  it('a webp image page', async function () {
    skipIfMissing(this, 'photo.webp')
    await runSource(
      'safari-webp-page',
      {host: SAFARI, open: shareSafariPageSheet(url('photo.webp'))},
      {delivered: [{name: /\.jpe?g$/i, type: 'image'}], items: [{type: 'image'}]}
    )
  })

  it('an avif image page', async function () {
    skipIfMissing(this, 'photo.avif')
    await runSource(
      'safari-avif-page',
      {host: SAFARI, open: shareSafariPageSheet(url('photo.avif'))},
      {delivered: [{name: /\.jpe?g$/i, type: 'image'}], items: [{type: 'image'}]}
    )
  })

  // Shared from the link's menu: opening the .mp4 plays it full screen, where Safari's share sheet
  // can't be driven. The extension downloads the video the link points at.
  it('a direct .mp4 link', async function () {
    skipIfMissing(this, 'short.mp4')
    await runSource(
      'safari-mp4-link',
      {host: SAFARI, open: shareSafariElementSheet(url('index.html'), 'mp4 link')},
      {items: [{type: 'video'}], videoSeconds: 5}
    )
  })

  it('a PDF opened in Safari', async () => {
    await runSource(
      'safari-pdf',
      {host: SAFARI, open: shareSafariPageSheet(url('doc.pdf'), {settle: 4000})},
      {items: [{name: /\.pdf$/i, type: 'file'}]}
    )
  })
})
