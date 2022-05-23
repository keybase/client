import KB2, {type OpenDialogOptions, type SaveDialogOptions} from './electron.desktop'
const {showOpenDialog, showSaveDialog} = KB2.functions

export const pickImages = async (title: string) => {
  if (!showOpenDialog) return []
  const filePaths = await showOpenDialog({
    allowFiles: true,
    allowMultiselect: true,
    filters: [{extensions: ['jpg', 'png', 'gif'], name: 'Images'}],
    title,
  })
  return filePaths ?? []
}

export const pickFiles = async (options: OpenDialogOptions) => {
  if (!showOpenDialog) return []
  const filePaths = await showOpenDialog(options)
  return filePaths ?? []
}

export const pickSave = async (options: SaveDialogOptions) => {
  if (!showSaveDialog) return []
  const res = await showSaveDialog(options)
  return res
}
