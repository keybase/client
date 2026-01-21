import {processVideo as nativeProcessVideo, showVideoPickerForCompression} from 'react-native-kb'
import {Platform} from 'react-native'

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
    console.error('compress error', error)
    return path
  }
}

export const compressVideoWithPicker = async (): Promise<string | null> => {
  if (Platform.OS !== 'ios') {
    return null
  }

  try {
    const compressedPath = await showVideoPickerForCompression()
    return compressedPath
  } catch (error) {
    console.error('video picker error', error)
    return null
  }
}
