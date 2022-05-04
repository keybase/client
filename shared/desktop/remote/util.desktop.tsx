import * as Electron from 'electron'
import type {TypedActions} from '../../actions/typed-actions-gen'

const {type} = KB.process
const isRenderer = type === 'renderer'

export const getMainWindow = (): Electron.BrowserWindow | null => {
  const w = Electron.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/main.'))
  return w || null
}

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
