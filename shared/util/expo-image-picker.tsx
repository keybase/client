import {isIOS} from '../constants/platform'
import * as ImagePicker from 'expo-image-picker'
import * as Permissions from 'expo-permissions'

export const parseUri = (result: {uri: string}): string => {
  return isIOS ? result.uri.replace('file://', '') : result.uri.replace('file:', '')
}

const retyAfterAskingPerm = (retryFn: null | (() => Promise<ImagePicker.ImagePickerResult>)) => (
  error: any
): Promise<ImagePicker.ImagePickerResult> => {
  if (error.code === 'E_MISSING_PERMISSION' && retryFn) {
    return Permissions.askAsync(Permissions.CAMERA, Permissions.CAMERA_ROLL).then(retryFn)
  } else {
    throw error
  }
}

const mediaTypeToImagePickerMediaType = (
  mediaType: 'photo' | 'video' | 'mixed'
): ImagePicker.MediaTypeOptions =>
  mediaType === 'photo'
    ? ImagePicker.MediaTypeOptions.Images
    : mediaType === 'video'
    ? ImagePicker.MediaTypeOptions.Videos
    : ImagePicker.MediaTypeOptions.All

export const launchCameraAsync = (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true
): Promise<ImagePicker.ImagePickerResult> => {
  return ImagePicker.launchCameraAsync({mediaTypes: mediaTypeToImagePickerMediaType(mediaType)}).catch(
    retyAfterAskingPerm(askPermAndRetry ? () => launchCameraAsync(mediaType, false) : null)
  )
}

export const launchImageLibraryAsync = (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true
): Promise<ImagePicker.ImagePickerResult> => {
  return ImagePicker.launchImageLibraryAsync({mediaTypes: mediaTypeToImagePickerMediaType(mediaType)}).catch(
    retyAfterAskingPerm(askPermAndRetry ? () => launchImageLibraryAsync(mediaType, false) : null)
  )
}
