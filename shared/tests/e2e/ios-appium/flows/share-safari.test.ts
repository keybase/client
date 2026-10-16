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
const exactly = (s: string) => new RegExp(`^${escape(s)}$`)
// A link Safari captions comes after the caption's line.
const link = (s: string) => new RegExp(`(^|\\n)${escape(s)}$`)

describe('Share from Safari', () => {
  let server: Awaited<ReturnType<typeof startAssetServer>> | undefined
  const url = (name: string) => `${server!.origin}/${name}`

  before(async () => {
    server = await startAssetServer()
  })
  after(() => {
    server?.close()
  })

  // Every Safari source also checks that the share extension made no request of its own: a shared
  // link is sent as the link, never probed or downloaded.
  const run = async (source: string, sheet: SheetSource, expected: Expected) => {
    const since = server!.requests.length
    await runSource(source, sheet, expected)
    const fetched = extensionRequests(server!.requests, since)
    if (fetched.length) {
      throw new Error(`the share extension fetched: ${fetched.map(r => `${r.method} ${r.path}`).join(', ')}`)
    }
  }

  // Safari captions the link with the page's title, which goes ahead of it.
  it('the page URL from the toolbar', async () => {
    const page = url('index.html')
    await run('safari-page-url', {host: SAFARI, open: shareSafariPageSheet(page)}, {
      items: [{content: new RegExp(`^Share Matrix\\n${escape(page)}$`), type: 'text'}],
    })
  })

  // Safari hands over the image's address, not the image, and a shared address is sent as the link.
  it('a long-pressed image', async () => {
    await run('safari-long-press-image', {host: SAFARI, open: shareSafariElementSheet(url('index.html'), 'matrix photo')}, {
      items: [{content: link(url('photo-a.png')), type: 'text'}],
    })
  })

  it('a long-pressed .png link', async () => {
    await run('safari-png-link', {host: SAFARI, open: shareSafariElementSheet(url('index.html'), 'png link')}, {
      items: [{content: link(url('photo-b.png')), type: 'text'}],
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
  // can't be driven. The link arrives as the link, not the video it points at.
  it('a direct .mp4 link', async () => {
    await run('safari-mp4-link', {host: SAFARI, open: shareSafariElementSheet(url('index.html'), 'mp4 link')}, {
      items: [{content: exactly(url('short.mp4')), type: 'text'}],
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
