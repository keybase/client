import logger from '@/logger'
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

export const processPaths = async (
  items: ReadonlyArray<ProcessItem>,
  compress: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<Array<string>> => {
  if (!isIOS) return items.map(i => i.path)
  const out: Array<string> = []
  for (const [idx, {path, edit}] of items.entries()) {
    try {
      out.push(
        await processMediaNative(
          path,
          isVideoPath(path),
          compress,
          edit?.startMs ?? 0,
          edit?.endMs ?? 0,
          edit?.removeAudio ?? false
        )
      )
    } catch (e) {
      // Processing is best-effort: an unsupported or corrupt file still gets
      // sent, just unprocessed. Logged because a silent fallback here means an
      // uncompressed upload with the setting nominally on.
      logger.warn('processMedia failed', e)
      out.push(path)
    }
    onProgress?.(idx + 1, items.length)
  }
  return out
}
