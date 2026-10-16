// Share-source matrix: the Files app, from a folder seeded in its "On My iPhone" storage.
import {FILES, missingAsset, runSource, seedFilesFolder, shareFilesSheet, skipIfMissing} from '../helpers/share'

describe('Share from Files', () => {
  let dir = ''
  before(() => {
    dir = seedFilesFolder(
      'ShareMatrix',
      ['doc.pdf', 'bundle.zip', 'small.tif', 'empty.dat', 'photo-b.png', 'short.mp4'].filter(n => !missingAsset(n))
    )
  })

  it('a pdf', async () => {
    await runSource('files-pdf', {host: FILES, open: shareFilesSheet(dir, ['doc.pdf'])}, {items: [{name: /^doc\.pdf$/, type: 'file'}]})
  })

  it('a zip', async () => {
    await runSource('files-zip', {host: FILES, open: shareFilesSheet(dir, ['bundle.zip'])}, {items: [{name: /^bundle\.zip$/, type: 'file'}]})
  })

  // The extension copies the TIFF as an image; the app sends it as a JPEG.
  it('a tiff', async () => {
    await runSource(
      'files-tiff',
      {host: FILES, open: shareFilesSheet(dir, ['small.tif'])},
      {delivered: [{name: /\.jpe?g$/i, type: 'image'}], items: [{name: /^small\.tif$/, type: 'image'}]}
    )
  })

  it('a 0-byte file', async () => {
    await runSource('files-empty', {host: FILES, open: shareFilesSheet(dir, ['empty.dat'])}, {items: [{name: /^empty\.dat$/, type: 'file'}]})
  })

  it('several mixed files', async function () {
    skipIfMissing(this, 'short.mp4')
    await runSource(
      'files-mixed',
      {host: FILES, open: shareFilesSheet(dir, ['doc.pdf', 'photo-b.png', 'short.mp4'])},
      {
        items: [
          {name: /^doc\.pdf$/, type: 'file'},
          {name: /^photo-b\.png$/, type: 'image'},
          {name: /^short\.mp4$/, type: 'video'},
        ],
        delivered: [
          {name: /^doc\.pdf$/, type: 'file'},
          {name: /^photo-b\./, type: 'image'},
          {name: /^short\./, type: 'video'},
        ],
        videoSeconds: 5,
      }
    )
  })
})
