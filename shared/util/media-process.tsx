import logger from '@/logger'
import {File} from 'expo-file-system'
import {processMedia as processMediaNative} from 'react-native-kb'

const videoFileNameRegex = /[^/]+\.(mp4|mov|avi|mkv)$/i
// heic/heif are here because processImage transcodes them to jpeg; gif is not,
// because scaling one would flatten an animation to a single frame.
const processableImageFileNameRegex = /[^/]+\.(jpg|jpeg|png|bmp|heic|heif)$/i

export const isVideoPath = (path: string) => videoFileNameRegex.test(path)

// The single source of truth for "the native processor can handle this".
export const canProcess = (path: string) =>
  isVideoPath(path) || processableImageFileNameRegex.test(path)

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

export const processPaths = async (
  items: ReadonlyArray<ProcessItem>,
  compress: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<Array<ProcessResult>> => {
  if (!isIOS) return items.map(i => ({path: i.path}))
  const out: Array<ProcessResult> = []
  for (const [idx, {path, edit}] of items.entries()) {
    try {
      out.push({
        path: await processMediaNative(
          path,
          isVideoPath(path),
          compress,
          edit?.startMs ?? 0,
          edit?.endMs ?? 0,
          edit?.removeAudio ?? false
        ),
      })
    } catch (e) {
      logger.warn('processMedia failed', e)
      out.push({error: e instanceof Error ? e.message : String(e), path})
    }
    onProgress?.(idx + 1, items.length)
  }
  deleteConsumedSources(items, out)
  return out
}

// The export writes its output alongside the source, so leaving the source
// behind means every share costs the original plus the processed copy until iOS
// decides to purge the cache. Once the whole batch has exported, the sources are
// dead: the compress choice was made before the export and the originals are
// never offered again.
const deleteConsumedSources = (items: ReadonlyArray<ProcessItem>, out: ReadonlyArray<ProcessResult>) => {
  // A single failure sends the user to "Send original", which uploads the very
  // paths we would be deleting, so it's all or nothing.
  if (out.some(r => r.error)) return
  const sources = new Set<string>()
  items.forEach(({path}, i) => {
    // Untouched passthrough (an image with compression off) hands the same path
    // back — that one is the upload.
    if (out[i]?.path !== path) {
      sources.add(path)
    }
  })
  for (const path of sources) {
    try {
      new File(path).delete()
    } catch (e) {
      logger.warn('processMedia source cleanup failed', e)
    }
  }
}
