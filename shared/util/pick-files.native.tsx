import {launchImageLibraryAsync} from './expo-image-picker.native'
import {pickDocumentsAsync} from './expo-document-picker.native'
import type {OpenDialogOptions, SaveDialogOptions} from './electron.desktop'

export const pickImages = async (_: string): Promise<Array<string>> => {
  const result = await launchImageLibraryAsync('photo')
  return result.canceled ? [] : result.assets.map(a => a.uri)
}

export const pickFiles = async (_options: OpenDialogOptions): Promise<Array<string>> => {
  const result = await pickDocumentsAsync(true)
  return result.canceled ? [] : result.assets.map(a => a.uri)
}

export const pickSave = (_options: SaveDialogOptions) => {
  throw new Error('No supported platform')
}
