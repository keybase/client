import * as Electron from 'electron'

const pickFiles = async (title: string): Promise<Array<string>> => {
  const res = await Electron.remote.dialog.showOpenDialog(Electron.remote.getCurrentWindow(), {
    filters: [{extensions: ['jpg', 'png', 'gif'], name: 'Images'}],
    properties: ['multiSelections', 'openFile'],
    title,
  })
  return res.filePaths
}

export default pickFiles
