import * as ImagePicker from 'expo-image-picker'

// built lazily: on desktop expo-image-picker is nulled out by the bundler, so
// dereferencing its enums at module scope crashes at import time
//
// `raw` is for chat attach only: MediaUtils on the get-titles screen owns trim +
// compression for both the share extension and in-chat attach, so those picks should hand
// back originals untouched (quality: 1 also avoids an iOS JPEG recompress pass before
// MediaUtils.processImage ever sees the image). Every other caller (avatar upload, emoji
// upload, KBFS upload) has nothing downstream that compresses, so they keep the picker's
// own compression.
const getDefaultOptions = (raw: boolean) => ({
  allowsEditing: false,
  exif: false,
  quality: raw ? 1 : 0.4,
  videoExportPreset: raw ? ImagePicker.VideoExportPreset.Passthrough : ImagePicker.VideoExportPreset.MediumQuality,
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
}) as const

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
  askPermAndRetry: boolean = true,
  raw: boolean = false
): Promise<ImagePicker.ImagePickerResult> => {
  if (!isMobile) return canceled
  let res: ImagePicker.ImagePickerResult | undefined
  try {
    res = await ImagePicker.launchCameraAsync({
      ...getDefaultOptions(raw),
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
    return launchCameraAsync(mediaType, false, raw)
  }
  return guardUndefined(res, 'launchCameraAsync')
}

export const launchImageLibraryAsync = async (
  mediaType: 'photo' | 'video' | 'mixed',
  askPermAndRetry: boolean = true,
  allowsMultipleSelection: boolean = false,
  raw: boolean = false
): Promise<ImagePicker.ImagePickerResult> => {
  if (!isMobile) return canceled
  let res: ImagePicker.ImagePickerResult | undefined
  try {
    res = await ImagePicker.launchImageLibraryAsync({
      ...getDefaultOptions(raw),
      allowsMultipleSelection,
      mediaTypes: mediaTypeToImagePickerMediaType(mediaType),
    })
  } catch (e) {
    if (!askPermAndRetry) {
      throw e
    }
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync()
    } catch {}
    return launchImageLibraryAsync(mediaType, false, allowsMultipleSelection, raw)
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
