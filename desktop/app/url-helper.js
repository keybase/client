import {ipcMain} from 'electron'
import keybaseUrl from '../shared/constants/urls'
import openUrl from '../shared/util/open-url'

const linkFuncs = {
  home: () => keybaseUrl,
  help: () => `${keybaseUrl}/getting-started`,
  user: ({username}) => `${keybaseUrl}/${username || ''}`,
}

export default function () {
  ipcMain.on('openURL', (event, type, params) => {
    const linkFunc = linkFuncs[type]
    if (linkFunc) {
      const link = linkFunc(params)
      if (link) {
        openUrl(link)
      }
    } else {
      console.warn(`No openURL handler for ${type}`, params)
    }
  })
}
