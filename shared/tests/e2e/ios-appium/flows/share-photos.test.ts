// Share-source matrix: Photos. Each source adds its own media, so the newest grid items are its.
import {PHOTOS, addMedia, inApp, rotateNewestPhotos, runSource, sharePhotosSheet, skipIfMissing, skipSource} from '../helpers/share'

const png = /\.png$/i

describe('Share from Photos', () => {
  it('a single photo', async function () {
    addMedia(this, 'photo-a.png')
    await runSource('photos-single', {host: PHOTOS, open: sharePhotosSheet(1)}, {delivered: [{name: /^photo-a\./i, type: 'image'}], items: [{name: /^photo-a\.png$/i, type: 'image'}]})
  })

  it('five photos at once', async function () {
    addMedia(this, 'photo-a.png', 'photo-b.png', 'photo-c.png', 'photo-d.png', 'photo-e.png')
    await runSource(
      'photos-five',
      {host: PHOTOS, open: sharePhotosSheet(5)},
      {items: ['a', 'b', 'c', 'd', 'e'].map(l => ({name: new RegExp(`^photo-${l}\\.png$`, 'i'), type: 'image' as const}))}
    )
  })

  // Two edited photos in one share must arrive as two distinct files.
  it('two edited photos', async function () {
    addMedia(this, 'photo-c.png', 'photo-d.png')
    await inApp(PHOTOS, async () => rotateNewestPhotos(2))
    await runSource(
      'photos-two-edited',
      {fresh: true, host: PHOTOS, open: sharePhotosSheet(2)},
      {items: [{type: 'image'}, {type: 'image'}]}
    )
  })

  it('a Live Photo', function () {
    skipSource(this, 'not generatable: a Live Photo needs a paired HEIC and MOV carrying Apple asset identifiers')
  })

  it('a short video', async function () {
    skipIfMissing(this, 'short.mp4')
    addMedia(this, 'short.mp4')
    await runSource('photos-short-video', {host: PHOTOS, open: sharePhotosSheet(1)}, {items: [{type: 'video'}], videoSeconds: 5})
  })

  // The exported clip must keep its full length.
  it('a 75s 1080p video', async function () {
    skipIfMissing(this, 'long-1080p.mp4')
    addMedia(this, 'long-1080p.mp4')
    await runSource('photos-long-video', {host: PHOTOS, open: sharePhotosSheet(1)}, {items: [{type: 'video'}], videoSeconds: 75})
  })

  it('a screenshot taken on the device', function () {
    skipSource(this, 'the simulator has no way to take an in-device screenshot (no screenshot button or Markup thumbnail)')
  })

  it('a screen-sized PNG (a screenshot) from Photos', async function () {
    addMedia(this, 'screenshot.png')
    await runSource('photos-screenshot', {host: PHOTOS, open: sharePhotosSheet(1)}, {items: [{name: png, type: 'image'}]})
  })

  // The extension copies large originals without decoding them; the app transcodes the TIFF to JPEG.
  it('an 8000x6000 TIFF', async function () {
    addMedia(this, 'big.tif')
    await runSource(
      'photos-big-tiff',
      {host: PHOTOS, open: sharePhotosSheet(1)},
      {delivered: [{name: /\.jpe?g$/i, type: 'image'}], items: [{type: 'image'}]}
    )
  })

  it('an 8000x6000 PNG', async function () {
    addMedia(this, 'big.png')
    await runSource('photos-big-png', {host: PHOTOS, open: sharePhotosSheet(1)}, {items: [{name: png, type: 'image'}]})
  })

  it('a webp', async function () {
    skipIfMissing(this, 'photo.webp')
    addMedia(this, 'photo.webp')
    await runSource(
      'photos-webp',
      {host: PHOTOS, open: sharePhotosSheet(1)},
      {delivered: [{name: /\.jpe?g$/i, type: 'image'}], items: [{type: 'image'}]}
    )
  })

  // Photos may hand a HEIC over as a JPEG, so only the name's stem is checked.
  it('a HEIC', async function () {
    addMedia(this, 'photo.heic')
    await runSource(
      'photos-heic',
      {host: PHOTOS, open: sharePhotosSheet(1)},
      {delivered: [{name: /\.jpe?g$/i, type: 'image'}], items: [{name: /^photo\./i, type: 'image'}]}
    )
  })
})
