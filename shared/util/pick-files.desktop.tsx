import * as Electron from 'electron'

const pickFiles = async (title: string): Promise<Array<string>> => {
  console.log({songgao: 'pickFiles', title})
  const res = await Electron.remote.dialog.showOpenDialog(Electron.remote.getCurrentWindow(), {
    filters: [{extensions: ['jpg', 'png', 'gif'], name: 'Images'}],
    properties: ['multiSelections', 'openFile'],
    title,
  })
  console.log({songgao: 'pickFiles', title, res})
  return res.filePaths
}

export default pickFiles
