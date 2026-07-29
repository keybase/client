import logger from '@/logger'
import {trimVideo as trimVideoNative, processMedia as processMediaNative} from 'react-native-kb'

const videoFileNameRegex = /[^/]+\.(mp4|mov|avi|mkv)$/i
// heic/heif are here because processImage transcodes them to jpeg; gif is not,
// because scaling one would flatten an animation to a single frame.
const processableImageFileNameRegex = /[^/]+\.(jpg|jpeg|png|bmp|heic|heif)$/i

export const isVideoPath = (path: string) => videoFileNameRegex.test(path)

// The single source of truth for "the native processor can handle this".
export const canProcess = (path: string) =>
  isVideoPath(path) || processableImageFileNameRegex.test(path)

export const canTrim = (path: string) => isIOS && isVideoPath(path)

// Resolves to the trimmed path, or the input path when the user cancels or
// leaves the range alone. Callers never have to distinguish those cases.
export const trimVideo = async (path: string): Promise<string> => {
  if (!canTrim(path)) return path
  try {
    // empty means canceled or unchanged
    const edited = await trimVideoNative(path)
    return edited || path
  } catch (e) {
    logger.warn('trimVideo failed', e)
    return path
  }
}

export const processPaths = async (
  paths: ReadonlyArray<string>,
  compress: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<Array<string>> => {
  if (!isIOS) return [...paths]
  const out: Array<string> = []
  for (const [idx, path] of paths.entries()) {
    try {
      out.push(await processMediaNative(path, isVideoPath(path), compress))
    } catch (e) {
      // Processing is best-effort: an unsupported or corrupt file still gets
      // sent, just unprocessed. Logged because a silent fallback here means an
      // uncompressed upload with the setting nominally on.
      logger.warn('processMedia failed', e)
      out.push(path)
    }
    onProgress?.(idx + 1, paths.length)
  }
  return out
}
