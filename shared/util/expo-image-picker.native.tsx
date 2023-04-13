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
  async (error: any): Promise<ImagePicker.ImagePickerResult> => {
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
  allowsEditing: false,
  exif: false,
  quality: 0.4,
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
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

export const launchCameraAsync = async (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true
): Promise<ImagePicker.ImagePickerResult> => {
  return ImagePicker.launchCameraAsync({
    ...defaultOptions,
    mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
  }).catch(
    retyAfterAskingPerm(true, true, askPermAndRetry ? async () => launchCameraAsync(mediaType, false) : null)
  )
}

export const launchImageLibraryAsync = async (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true,
  allowsMultipleSelection: boolean = false
): Promise<ImagePicker.ImagePickerResult> => {
  return ImagePicker.launchImageLibraryAsync({
    ...defaultOptions,
    allowsMultipleSelection,
    ...(mediaType === 'video' ? {allowsEditing: true, allowsMultipleSelection: false} : {}),
    mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
  }).catch(
    retyAfterAskingPerm(
      false,
      true,
      askPermAndRetry ? async () => launchImageLibraryAsync(mediaType, false, allowsMultipleSelection) : null
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
