export type ImagePickerResult = {assets: null; canceled: true}
export type ImageInfo = {uri: string; width: number; height: number; type?: 'image' | 'video'}

// eslint-disable-next-line @typescript-eslint/require-await
export const launchCameraAsync = async (): Promise<ImagePickerResult> => ({assets: null, canceled: true})
// eslint-disable-next-line @typescript-eslint/require-await
export const launchImageLibraryAsync = async (): Promise<ImagePickerResult> => ({assets: null, canceled: true})
