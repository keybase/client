import * as C from '@/constants'
import {processVideo as nativeProcessVideo} from 'react-native-kb'

const videoFileExtensions = /\.(mp4|mov|avi|mkv|3gp|webm|m4v|mpeg|mpg|wmv|flv)$/i

const isVideoFile = (path: string): boolean => {
  return videoFileExtensions.test(path)
}

export const compressVideo = async (path: string): Promise<string> => {
  if (!isVideoFile(path)) {
    return path
  }

  try {
    const compressedPath = await nativeProcessVideo(path)
    return compressedPath
  } catch (error) {
    C.ignorePromise(error)
    return path
  }
}
