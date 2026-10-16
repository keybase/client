import logger from '@/logger'
import {File} from 'expo-file-system'
import {processMedia as processMediaNative} from 'react-native-kb'

const videoFileNameRegex = /[^/]+\.(mp4|mov|avi|mkv)$/i
// heic/heif, tiff, RAW (dng and camera formats), webp, avif and the other photo
// formats ImageIO reads are here because processImage transcodes them to jpeg; the
// share extension hands them over untouched since decoding them can exceed its
// memory limit. An image left off this list is uploaded as is on every path,
// location metadata included. gif is not here, because scaling one would flatten
// an animation to a single frame.
// Which of these are transcoded even with compression off is the native side's
// call (MediaUtils.mustTranscode), by content type.
const processableImageFileNameRegex =
  /[^/]+\.(jpg|jpeg|jpe|png|bmp|heic|heics|heif|hif|avci|tiff|tif|webp|avif|jxl|jp2|jpf|jpx|j2k|mpo|psd|dng|cr2|cr3|crw|nef|nefx|nrw|arw|srf|sr2|axr|raf|orf|ori|rw2|raw|rwl|pef|srw|erf|3fr|fff|dcr|mrw|mos|iiq|dxo)$/i

export const isVideoPath = (path: string) => videoFileNameRegex.test(path)

export const isProcessableImagePath = (path: string) => processableImageFileNameRegex.test(path)

// The single source of truth for "the native processor can handle this".
export const canProcess = (path: string) => isVideoPath(path) || isProcessableImagePath(path)

// A trim range plus the audio choice. endMs of 0 means "to the end of the clip",
// so a range the user never moved off the tail stays a noop.
export type VideoEdit = {
  startMs: number
  endMs: number
  removeAudio: boolean
}

// The shortest selection the handles allow. Also guards against exporting an
// empty range if a drag lands both handles in the same spot.
export const minTrimMs = 1000

export const canEdit = (path: string) => isIOS && isVideoPath(path)

export const isEditNoop = (edit?: VideoEdit) =>
  !edit || (edit.startMs === 0 && edit.endMs === 0 && !edit.removeAudio)

// Keeps a dragged pair of handles legal: inside the clip, in order, and at least
// minTrimMs apart. `moved` says which handle the user has hold of, so the other
// one is what gives way when they collide.
export const clampRange = (
  startMs: number,
  endMs: number,
  durationMs: number,
  moved: 'start' | 'end'
): {startMs: number; endMs: number} => {
  const total = Math.max(0, durationMs)
  // Too short to trim at all: hand back the whole clip.
  if (total <= minTrimMs) {
    return {endMs: total, startMs: 0}
  }
  let s = Math.min(Math.max(0, startMs), total)
  let e = Math.min(Math.max(0, endMs), total)
  if (moved === 'start') {
    s = Math.min(s, total - minTrimMs)
    e = Math.max(e, s + minTrimMs)
  } else {
    e = Math.max(e, minTrimMs)
    s = Math.min(s, e - minTrimMs)
  }
  return {endMs: e, startMs: s}
}

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export type ProcessItem = {
  path: string
  edit?: VideoEdit
}

// The original path is always usable, so a failure still yields something to
// upload; error says the bytes are the untouched ones, which the caller has to
// tell the user about rather than quietly sending an uncompressed or untrimmed
// clip.
export type ProcessResult = {
  path: string
  error?: string
}

// Never empty: an empty error reads as success to everything that checks it.
export const processingErrorMessage = (e: unknown) =>
  (e instanceof Error ? e.message : String(e)) || 'Processing failed'

// Native hands back every path with a file:// prefix, while a source can arrive
// bare (pasted images do). The prefix is the only difference — native neither
// adds nor removes percent-encoding (kbJSPath/kbBarePath in Kb.mm) — so this is
// the one form any two paths are compared in.
const barePath = (p: string) => (p.startsWith('file://') ? p.slice('file://'.length) : p)

export const processPaths = async (
  items: ReadonlyArray<ProcessItem>,
  compress: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<Array<ProcessResult>> => {
  if (!isIOS) return items.map(i => ({path: i.path}))
  const out: Array<ProcessResult> = []
  for (const [idx, {path, edit}] of items.entries()) {
    try {
      const processed = await processMediaNative(
        path,
        isVideoPath(path),
        compress,
        edit?.startMs ?? 0,
        edit?.endMs ?? 0,
        edit?.removeAudio ?? false
      )
      // A passthrough is the source itself; hand back the caller's own string.
      out.push({path: barePath(processed) === barePath(path) ? path : processed})
    } catch (e) {
      logger.warn('processMedia failed', e)
      out.push({error: processingErrorMessage(e), path})
    }
    // Once anything has exported this must not throw: the caller would lose the
    // output paths it needs to clean up.
    try {
      onProgress?.(idx + 1, items.length)
    } catch (e) {
      logger.warn('processMedia progress callback failed', e)
    }
  }
  return out
}

// Never deletes anything that is, in any form, one of `keep`.
const deleteFilesExcept = (paths: Iterable<string>, keep: Iterable<string>, what: string) => {
  const kept = new Set([...keep].map(barePath))
  // keyed by the bare form so one file given in two forms is deleted once
  const doomed = new Map<string, string>()
  for (const path of paths) {
    const bare = barePath(path)
    if (!kept.has(bare)) {
      doomed.set(bare, path)
    }
  }
  for (const path of doomed.values()) {
    try {
      new File(path).delete()
    } catch (e) {
      logger.warn(`processMedia ${what} cleanup failed`, e)
    }
  }
}

// processPaths leaves every file in place: the caller settles the batch with
// exactly one of these once it knows whether the outputs are being uploaded.

// The export writes its output alongside the source, so leaving the source
// behind means every share costs the original plus the processed copy until iOS
// decides to purge the cache. Call this only once the outputs have been handed
// to upload: until then the user can still back out, and a later retry or "Send
// original" needs the originals.
export const deleteConsumedSources = (
  items: ReadonlyArray<ProcessItem>,
  out: ReadonlyArray<ProcessResult>
) => {
  // A single failure sends the user to "Send original", which uploads the very
  // paths we would be deleting, so it's all or nothing.
  if (out.some(r => r.error)) return
  // An untouched passthrough (an image with compression off) is the upload.
  deleteFilesExcept(
    items.map(i => i.path),
    out.map(r => r.path),
    'source'
  )
}

// For a batch that won't be uploaded (a failure, or the user backed out while it
// exported): the outputs are orphans nothing will ever point at again, and the
// originals stay for whatever comes next.
export const discardProcessedOutputs = (
  items: ReadonlyArray<ProcessItem>,
  out: ReadonlyArray<ProcessResult>
) => {
  // A failed item reports its original, and a passthrough is the original.
  deleteFilesExcept(
    out.filter(r => !r.error).map(r => r.path),
    items.map(i => i.path),
    'output'
  )
}
