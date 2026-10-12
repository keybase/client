import type * as React from 'react'
import KB2 from './electron'

// Chromium hands a pasted bitmap (screenshot, copied image) to the page as an image/png file.
// The upload is named paste.png, so other types go through the main process, which re-encodes.
export const pickPastedPNG = <F extends {type: string}>(files: ArrayLike<F>): F | undefined =>
  Array.from(files).find(f => f.type === 'image/png')

const textOnlyTypes = new Set(['text/plain', 'text/html', 'text/rtf'])

// Whether a paste is worth a main-process clipboard read. Only a clipboard holding nothing but
// text is skipped: Files, image/* or an unknown type may be an image (a TIFF, a Finder file copy)
// that Chromium doesn't expose as a pasted file.
export const clipboardMayHoldImage = (types: ReadonlyArray<string>) =>
  types.length === 0 || types.some(t => !textOnlyTypes.has(t))

// Decoding and re-encoding validates the image and strips its metadata (GPS, author, etc.).
const reencodePNG = async (file: Blob): Promise<Uint8Array | undefined> => {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return undefined
  }
  try {
    if (bitmap.width === 0 || bitmap.height === 0) return undefined
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(bitmap, 0, 0)
    const blob = await canvas.convertToBlob({type: 'image/png'})
    return new Uint8Array(await blob.arrayBuffer())
  } catch {
    return undefined
  } finally {
    bitmap.close()
  }
}

// Call from the paste handler itself: clipboardData is emptied once the handler returns, so
// everything read from it happens before the first await.
export const readImageFromPaste = async (event: React.ClipboardEvent): Promise<Uint8Array | undefined> => {
  const {files, types} = event.clipboardData
  const file = pickPastedPNG(files)
  const askMain = clipboardMayHoldImage(types)
  const png = file ? await reencodePNG(file) : undefined
  if (png) return png
  return askMain ? KB2.functions.readImageFromClipboard?.() : undefined
}
