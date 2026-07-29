import {trimVideo as trimVideoNative, processMedia as processMediaNative} from 'react-native-kb'

const videoFileNameRegex = /[^/]+\.(mp4|mov|avi|mkv)$/i

export const isVideoPath = (path: string) => videoFileNameRegex.test(path)

export const canTrim = (path: string) => isIOS && isVideoPath(path)

// Resolves to the trimmed path, or the input path when the user cancels or
// leaves the range alone. Callers never have to distinguish those cases.
export const trimVideo = async (path: string): Promise<string> => {
  if (!canTrim(path)) return path
  try {
    const edited = await trimVideoNative(path)
    return edited ?? path
  } catch {
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
    } catch {
      // Processing is best-effort: an unsupported or corrupt file still gets
      // sent, just unprocessed.
      out.push(path)
    }
    onProgress?.(idx + 1, paths.length)
  }
  return out
}
