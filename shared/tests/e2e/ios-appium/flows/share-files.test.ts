// Share-source matrix: the Files app, from a folder seeded in its "On My iPhone" storage.
import {FILES, runSource, shareFilesSheet, skipIfMissing} from '../helpers/share'

// Text files are documents the user picked: each goes as a file under its own name, never pasted into
// the composer (a Latin-1 one used to paste its local path).
const textFiles = ['notes.txt', 'data.csv', 'README.md', 'main.swift', 'latin1.txt', 'long.md']
// Types the extension has no special handling for still go as files.
const documents = ['clip.m4a', 'invite.ics', 'doc.docx', 'data.json', 'page.html', 'note.rtf']
const exactly = (name: string) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

describe('Share from Files', () => {
  // each source seeds the folder with only its own files
  const dir = 'ShareMatrix'

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

  ;[...textFiles, ...documents].forEach(name => {
    it(`a ${name} file`, async function () {
      skipIfMissing(this, name)
      await runSource(`files-${name}`, {host: FILES, open: shareFilesSheet(dir, [name])}, {items: [{name: exactly(name), type: 'file'}]})
    })
  })

  it('two text files at once', async () => {
    await runSource(
      'files-two-txt',
      {host: FILES, open: shareFilesSheet(dir, ['notes.txt', 'notes2.txt'])},
      {items: [{name: /^notes\.txt$/, type: 'file'}, {name: /^notes2\.txt$/, type: 'file'}]}
    )
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
