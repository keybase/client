// Share-source matrix: Safari, against pages served from the host's loopback interface.
import {
  SAFARI,
  type Expected,
  type SheetSource,
  extensionRequests,
  skipIfMissing,
  runSource,
  shareSafariElementSheet,
  shareSafariPageSheet,
  startAssetServer,
} from '../helpers/share'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

describe('Share from Safari', () => {
  let server: Awaited<ReturnType<typeof startAssetServer>> | undefined
  const url = (name: string) => `${server!.origin}/${name}`

  before(async () => {
    server = await startAssetServer()
  })
  after(() => {
    server?.close()
  })

  // linkOnly: a link the extension must send as the link, after at most a HEAD probe; it must never
  // download the page.
  const run = async (source: string, sheet: SheetSource, expected: Expected, {linkOnly = false} = {}) => {
    const since = server!.requests.length
    await runSource(source, sheet, expected)
    const fetched = extensionRequests(server!.requests, since).filter(r => r.method !== 'HEAD')
    if (linkOnly && fetched.length) {
      throw new Error(`the share extension fetched: ${fetched.map(r => `${r.method} ${r.path}`).join(', ')}`)
    }
  }

  // Safari captions the link with the page's title, which goes ahead of it.
  it('the page URL from the toolbar', async () => {
    const page = url('index.html')
    await run(
      'safari-page-url',
      {host: SAFARI, open: shareSafariPageSheet(page)},
      {items: [{content: new RegExp(`^Share Matrix\\n${escape(page)}$`), type: 'text'}]},
      {linkOnly: true}
    )
  })

  // Safari hands over the image's address; the extension downloads the image itself.
  it('a long-pressed image', async () => {
    await run('safari-long-press-image', {host: SAFARI, open: shareSafariElementSheet(url('index.html'), 'matrix photo')}, {
      items: [{name: /^photo-a\.png$/i, type: 'image'}],
    })
  })

  // A link whose path names an image is downloaded too.
  it('a long-pressed .png link', async () => {
    await run('safari-png-link', {host: SAFARI, open: shareSafariElementSheet(url('index.html'), 'png link')}, {
      items: [{name: /^photo-b\.png$/i, type: 'image'}],
    })
  })

  // Safari adds the page as a second item next to the image; only the image is shared.
  it('a webp image page', async function () {
    skipIfMissing(this, 'photo.webp')
    await run(
      'safari-webp-page',
      {host: SAFARI, open: shareSafariPageSheet(url('photo.webp'))},
      {delivered: [{name: /\.jpe?g$/i, type: 'image'}], items: [{type: 'image'}]}
    )
  })

  it('an avif image page', async function () {
    skipIfMissing(this, 'photo.avif')
    await run(
      'safari-avif-page',
      {host: SAFARI, open: shareSafariPageSheet(url('photo.avif'))},
      {delivered: [{name: /\.jpe?g$/i, type: 'image'}], items: [{type: 'image'}]}
    )
  })

  // Shared from the link's menu: opening the .mp4 plays it full screen, where Safari's share sheet
  // can't be driven. The extension downloads the video the link points at.
  it('a direct .mp4 link', async function () {
    skipIfMissing(this, 'short.mp4')
    await run('safari-mp4-link', {host: SAFARI, open: shareSafariElementSheet(url('index.html'), 'mp4 link')}, {
      items: [{name: /^short\.mp4$/, type: 'video'}],
      videoSeconds: 5,
    })
  })

  it('a PDF opened in Safari', async () => {
    await run(
      'safari-pdf',
      {host: SAFARI, open: shareSafariPageSheet(url('doc.pdf'), {settle: 4000})},
      {items: [{name: /\.pdf$/i, type: 'file'}]}
    )
  })
})
