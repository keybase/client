import * as ImagePicker from 'expo-image-picker'

const defaultOptions = {
  allowsEditing: false,
  exif: false,
  quality: 0.4,
} as const

const mediaTypeToImagePickerMediaType = (
  mediaType: 'photo' | 'video' | 'mixed'
): Array<ImagePicker.MediaType> =>
  mediaType === 'photo' ? ['images'] : mediaType === 'video' ? ['videos'] : ['images', 'videos']

const canceled: ImagePicker.ImagePickerResult = {assets: null, canceled: true}

const guardUndefined = (res: ImagePicker.ImagePickerResult | undefined, name: string) => {
  if (!res) {
    // Expo 56 beta: native module returns undefined in some cases; treat as canceled.
    // Rebuild the dev client if this persists.
    console.error(`[expo-image-picker] ${name} returned undefined`)
    return canceled
  }
  return res
}

export const launchCameraAsync = async (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true
): Promise<ImagePicker.ImagePickerResult> => {
  if (!isMobile) return canceled
  let res: ImagePicker.ImagePickerResult | undefined
  try {
    res = await ImagePicker.launchCameraAsync({
      ...defaultOptions,
      mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
    })
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
  return guardUndefined(res, 'launchCameraAsync')
}

export const launchImageLibraryAsync = async (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true,
  allowsMultipleSelection: boolean = false
): Promise<ImagePicker.ImagePickerResult> => {
  if (!isMobile) return canceled
  let res: ImagePicker.ImagePickerResult | undefined
  try {
    res = await ImagePicker.launchImageLibraryAsync({
      ...defaultOptions,
      allowsMultipleSelection,
      ...(mediaType === 'video' ? {allowsEditing: true, allowsMultipleSelection: false} : {}),
      mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
    })
  } catch (e) {
    if (!askPermAndRetry) {
      throw e
    }
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    } catch {}
    return launchImageLibraryAsync(mediaType, false, allowsMultipleSelection)
  }
  return guardUndefined(res, 'launchImageLibraryAsync')
}
export type ImagePickerResult = ImagePicker.ImagePickerResult
export type ImageInfo = {
  uri: string
  width: number
  height: number
  type?: 'image' | 'video'
}
