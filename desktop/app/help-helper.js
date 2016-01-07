import {ipcMain, shell} from 'electron'
import {helpURL} from '../../react-native/react/constants/urls'

export default function () {
  ipcMain.on('showHelp', () => {
    shell.openExternal(helpURL)
  })
}
