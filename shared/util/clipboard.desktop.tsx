import type * as React from 'react'
import KB2 from './electron'
const {clipboardAvailableFormats} = KB2.functions

// Chromium hands a pasted bitmap (screenshot, copied image) to the page as an image/png file.
// The upload is named paste.png, so other types go through the main process, which re-encodes.
export const pickPastedPNG = <F extends {type: string}>(files: ArrayLike<F>): F | undefined =>
  Array.from(files).find(f => f.type === 'image/png')

const readImageFromMain = async () => {
  const formats = await (clipboardAvailableFormats?.() ?? new Array<string>())
  console.log('Read clipboard, formats:', formats)
  return KB2.functions.readImageFromClipboard?.() ?? undefined
}

// Call from the paste handler itself: clipboardData is emptied once the handler returns, so the
// files are picked before the first await.
export const readImageFromPaste = async (event: React.ClipboardEvent): Promise<Uint8Array | undefined> => {
  const file = pickPastedPNG(event.clipboardData.files)
  return file ? file.bytes() : readImageFromMain()
}
