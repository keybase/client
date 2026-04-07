import * as DocumentPicker from 'expo-document-picker'

export const pickDocumentsAsync = async (
  allowsMultipleSelection: boolean = false
): Promise<DocumentPicker.DocumentPickerResult> => {
  return DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: allowsMultipleSelection,
  })
}
