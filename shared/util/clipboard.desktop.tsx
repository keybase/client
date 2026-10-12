import type * as React from 'react'
import KB2 from './electron'

const textOnlyTypes = new Set(['text/plain', 'text/html', 'text/rtf'])

// Whether a paste is worth a main-process clipboard read. Only a clipboard holding nothing but
// text is skipped: Files, image/* or an unknown type may be an image (a TIFF, a Finder file copy).
export const clipboardMayHoldImage = (types: ReadonlyArray<string>) =>
  types.length === 0 || types.some(t => !textOnlyTypes.has(t))

// Call from the paste handler itself: clipboardData is emptied once the handler returns, so its
// types are read before the main-process round trip.
export const readImageFromPaste = async (event: React.ClipboardEvent): Promise<Uint8Array | undefined> => {
  if (!clipboardMayHoldImage(event.clipboardData.types)) return undefined
  return KB2.functions.readImageFromClipboard?.()
}
