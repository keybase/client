import {parseUri, launchImageLibraryAsync} from './expo-image-picker.native'
import type {OpenDialogOptions, SaveDialogOptions} from './electron.desktop'

export const pickImages = async (_: string): Promise<Array<string>> => {
  const result = await launchImageLibraryAsync('photo')
  return result.canceled ? [] : result.assets?.map(a => parseUri(a)) ?? []
}

export const pickFiles = (_options: OpenDialogOptions) => {
  throw new Error('No supported platform')
}

export const pickSave = (_options: SaveDialogOptions) => {
  throw new Error('No supported platform')
}
