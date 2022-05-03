import * as Electron from 'electron'
import type {TypedActions} from '../../actions/typed-actions-gen'

export const getMainWindow = (): Electron.BrowserWindow | null => {
  const w = Electron.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/main.'))
  return w || null
}

export const mainWindowDispatch = (action: TypedActions): void => {
  if (KB.constants.isRenderer) {
    Electron.ipcRenderer
      .invoke('KBdispatchAction', action)
      .then(() => {})
      .catch(() => {})
  } else {
    getMainWindow()?.webContents.send('KBdispatchAction', action)
  }
}
