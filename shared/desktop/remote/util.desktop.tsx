import * as SafeElectron from '../../util/safe-electron.desktop'
import {TypedActions} from '../../actions/typed-actions-gen'

export const getMainWindow = (): SafeElectron.BrowserWindowType | null => {
  const w = SafeElectron.BrowserWindow.getAllWindows().find(
    w => w.webContents.getURL().indexOf('/main.') !== -1
  )
  return w || null
}

export const mainWindowDispatch = (action: TypedActions): void => {
  SafeElectron.getApp().emit('KBdispatchAction', '', action)
}
