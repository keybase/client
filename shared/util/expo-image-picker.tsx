import {isIOS} from '../constants/platform'
import * as ImagePicker from 'expo-image-picker'
import * as Permissions from 'expo-permissions'

export const parseUri = (result: {uri: string}, withPrefix: boolean = false): string => {
  if (withPrefix) {
    return result.uri
  }
  return isIOS ? result.uri.replace('file://', '') : result.uri.replace('file:', '')
}

const retyAfterAskingPerm = (
  perms: Array<Permissions.PermissionType>,
  retryFn: null | (() => Promise<ImagePicker.ImagePickerResult>)
) => (error: any): Promise<ImagePicker.ImagePickerResult> => {
  if (error.code === 'E_MISSING_PERMISSION' && retryFn) {
    return Permissions.askAsync(...perms).then(retryFn)
  } else {
    throw error
  }
}

const quality = 0.4

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
  return ImagePicker.launchCameraAsync({
    exif: false,
    mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
    quality,
  }).catch(
    retyAfterAskingPerm(
      [Permissions.CAMERA, Permissions.CAMERA_ROLL],
      askPermAndRetry ? () => launchCameraAsync(mediaType, false) : null
    )
  )
}

export const launchImageLibraryAsync = (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true
): Promise<ImagePicker.ImagePickerResult> => {
  return ImagePicker.launchImageLibraryAsync({
    exif: false,
    mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
    quality,
  }).catch(
    retyAfterAskingPerm(
      [Permissions.CAMERA_ROLL],
      askPermAndRetry ? () => launchImageLibraryAsync(mediaType, false) : null
    )
  )
}
export type ImagePickerResult = ImagePicker.ImagePickerResult
export type ImageInfo = {
  uri: string
  width: number
  height: number
  type?: 'image' | 'video'
}
