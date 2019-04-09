// @flow
import * as SafeElectron from './safe-electron.desktop'

const closeWindow = () => {
  SafeElectron.getRemote()
    .getCurrentWindow()
    .hide()
}

export default closeWindow
