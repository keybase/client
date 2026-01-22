import * as ImagePicker from 'expo-image-picker'

const defaultOptions = {
  allowsEditing: false,
  exif: false,
  quality: 0.4,
  // even though this is marked as deprecated if its not set it will IGNORE ALL OTHER SETTINGS we pass here
  videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
} as const

const mediaTypeToImagePickerMediaType = (
  mediaType: 'photo' | 'video' | 'mixed'
): Array<ImagePicker.MediaType> =>
  mediaType === 'photo' ? ['images'] : mediaType === 'video' ? ['videos'] : ['images', 'videos']

export const launchCameraAsync = async (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true
): Promise<ImagePicker.ImagePickerResult> => {
  try {
    const res = await ImagePicker.launchCameraAsync({
      ...defaultOptions,
      mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
    })
    return res
  } catch (e) {
    if (!askPermAndRetry) {
      throw e
    }
    try {
      await ImagePicker.requestCameraPermissionsAsync()
    } catch {}
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    } catch {}
    return launchCameraAsync(mediaType, false)
  }
}

export const launchImageLibraryAsync = async (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true,
  allowsMultipleSelection: boolean = false
): Promise<ImagePicker.ImagePickerResult> => {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({
      ...defaultOptions,
      allowsMultipleSelection,
      ...(mediaType === 'video' ? {allowsEditing: true, allowsMultipleSelection: false} : {}),
      mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
    })
    return res
  } catch (e) {
    if (!askPermAndRetry) {
      throw e
    }
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    } catch {}
    return launchImageLibraryAsync(mediaType, false, allowsMultipleSelection)
  }
}
export type ImagePickerResult = ImagePicker.ImagePickerResult
export type ImageInfo = {
  uri: string
  width: number
  height: number
  type?: 'image' | 'video'
}
