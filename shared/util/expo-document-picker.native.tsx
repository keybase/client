import * as DocumentPicker from 'expo-document-picker'

export const pickDocumentsAsync = async (
  allowsMultipleSelection: boolean = false
): Promise<DocumentPicker.DocumentPickerResult> => {
  const res = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: allowsMultipleSelection,
  })
  return res ?? {assets: null, canceled: true}
}
