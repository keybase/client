const pickFiles = async (title: string): Promise<Array<string>> => {
  const filePaths = await KB.electron.dialog.showOpenDialog({
    allowFiles: true,
    allowMultiselect: true,
    filters: [{extensions: ['jpg', 'png', 'gif'], name: 'Images'}],
    title,
  })
  return filePaths ?? []
}

export default pickFiles
