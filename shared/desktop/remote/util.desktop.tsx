import * as Electron from 'electron'
import type {TypedActions} from '../../actions/typed-actions-gen'
import KB2 from '../../util/electron.desktop'
const {isRenderer} = KB2.constants

export const getMainWindow = (): Electron.BrowserWindow | null => {
  const w = Electron.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/main.'))
  return w || null
}

// TODO remove
export const mainWindowDispatch = (action: TypedActions): void => {
  if (isRenderer) {
    Electron.ipcRenderer
      .invoke('KBdispatchAction', action)
      .then(() => {})
      .catch(() => {})
  } else {
    getMainWindow()?.webContents.send('KBdispatchAction', action)
  }
}
