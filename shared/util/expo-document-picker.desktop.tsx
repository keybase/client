// Desktop stub — document picking is mobile-only. Only called in isMobile branches.
import type * as DocumentPicker from 'expo-document-picker'

export const pickDocumentsAsync = async (
  _allowsMultipleSelection: boolean = false
): Promise<DocumentPicker.DocumentPickerResult> => {
  await Promise.resolve()
  return {canceled: true, assets: null}
}
