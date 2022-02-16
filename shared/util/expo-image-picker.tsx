import {isIOS} from '../constants/platform'
import * as ImagePicker from 'expo-image-picker'

export const parseUri = (result: {uri: string}, withPrefix: boolean = false): string => {
  if (withPrefix) {
    return result.uri
  }
  return isIOS ? result.uri.replace('file://', '') : result.uri.replace('file:', '')
}

const retyAfterAskingPerm =
  (
    wantCamera: boolean,
    wantCameraRoll: boolean,
    retryFn: null | (() => Promise<ImagePicker.ImagePickerResult>)
  ) =>
  (error: any): Promise<ImagePicker.ImagePickerResult> => {
    if (error.code === 'E_MISSING_PERMISSION' && retryFn) {
      const checks = [
        ...(wantCamera ? [ImagePicker.getCameraPermissionsAsync()] : []),
        ...(wantCameraRoll ? [ImagePicker.getMediaLibraryPermissionsAsync()] : []),
      ]

      return Promise.all(checks).then(retryFn)
    } else {
      throw error
    }
  }

const defaultOptions = {
  exif: false,
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
  quality: 0.4,
  // even though this is marked as deprecated if its not set it will IGNORE ALL OTHER SETTINGS we pass here
  // videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
} as const

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
    ...defaultOptions,
    mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
  }).catch(
    retyAfterAskingPerm(true, true, askPermAndRetry ? () => launchCameraAsync(mediaType, false) : null)
  )
}

export const launchImageLibraryAsync = (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true
): Promise<ImagePicker.ImagePickerResult> => {
  return ImagePicker.launchImageLibraryAsync({
    ...defaultOptions,
    mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
  }).catch(
    retyAfterAskingPerm(false, true, askPermAndRetry ? () => launchImageLibraryAsync(mediaType, false) : null)
  )
}
export type ImagePickerResult = ImagePicker.ImagePickerResult
export type ImageInfo = {
  uri: string
  width: number
  height: number
  type?: 'image' | 'video'
}
