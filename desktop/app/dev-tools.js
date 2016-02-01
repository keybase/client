import {BrowserWindow, app, globalShortcut} from 'electron'
import {showDevTools} from '../shared/local-debug.desktop'

export default function () {
  app.on('ready', () => {
    globalShortcut.register('CommandOrControl+Alt+k+b', () => {
      BrowserWindow.getAllWindows().map(bw => {
        bw.openDevTools()
      })
    })
  })

  app.on('will-quit', () => {
    globalShortcut.unregister('CommandOrControl+Alt+k+b')
  })

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
