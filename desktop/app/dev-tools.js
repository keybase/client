import {BrowserWindow, app} from 'electron'
import {showDevTools} from '../../react-native/react/local-debug.desktop'

export default function () {
  if (!showDevTools) {
    return
  }

  app.on('browser-window-created', (e, win) => {
    win = win || BrowserWindow.getFocusedWindow()

    if (win) {
      win.openDevTools()
    }
  })
}
