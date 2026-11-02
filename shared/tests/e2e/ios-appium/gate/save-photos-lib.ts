// Save to Photos, pure: the large image a cancelled save downloads, and the read-back of what a save
// added to the photo library.
import {crc32, deflateSync} from 'zlib'

// A valid RGB png of `width` x `height` random pixels: noise does not compress, so the file is about
// width * height * 3 bytes, large enough that the phone's download of it is still running when the
// flow cancels it. `random(n)` gives n random bytes.
export const noisePng = (width: number, height: number, random: (n: number) => Buffer) => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('a png needs a positive whole size')
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([head, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  // 8 bits a channel, truecolour, deflate, adaptive filtering, no interlace
  ihdr.set([8, 2, 0, 0, 0], 8)
  const row = width * 3
  const raw = Buffer.alloc((row + 1) * height)
  for (let y = 0; y < height; y++) random(row).copy(raw, y * (row + 1) + 1)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, {level: 1})),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// An asset's kind and pixel size, as the photo library reads it.
export type AssetInfo = {height: number; mediaType: string; width: number}

// a PHAsset local identifier, as expo-media-library gives it
export const ASSET_ID_RE = /^(?:ph:\/\/)?[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\/L0\/001$/i

// The assets in the library `after` that it did not hold `before` (by id). Not by creation time: a
// saved file keeps its own date, which can tie with the corpus's.
export const newAssetIds = (before: ReadonlyArray<string>, after: ReadonlyArray<string>) => {
  const old = new Set(before)
  return after.filter(id => !old.has(id))
}

// What one save added to the library, proven: exactly one new asset, an image of the pixel size
// `pixels` ("<w>x<h>") by its `info`. Returns its id.
export const requireSavedImage = (added: ReadonlyArray<string>, info: AssetInfo | undefined, pixels: string) => {
  if (added.length !== 1) throw new Error(`the photo library has ${added.length} new assets after the save, not one`)
  const [id] = added
  if (!id || !ASSET_ID_RE.test(id)) throw new Error('the new asset after the save has no asset id')
  if (!info) throw new Error('the new asset after the save reads no info')
  if (info.mediaType !== 'image') throw new Error(`the new asset after the save is ${info.mediaType}, not an image`)
  if (`${info.width}x${info.height}` !== pixels) throw new Error(`the saved image is ${info.width}x${info.height}, not ${pixels}`)
  return id
}
