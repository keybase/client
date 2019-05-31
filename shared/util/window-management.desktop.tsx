import {BrowserWindow} from './safe-electron.desktop'

const closeWindow = () => {
  const win = BrowserWindow && BrowserWindow.getFocusedWindow()
  win && win.close()
}
const minimizeWindow = () => {
  const win = BrowserWindow && BrowserWindow.getFocusedWindow()
  win && win.minimize()
}
const toggleMaximizeWindow = () => {
  const win = BrowserWindow && BrowserWindow.getFocusedWindow()
  if (win) {
    win.isMaximized() ? win.unmaximize() : win.maximize()
  }
}

export {closeWindow, minimizeWindow, toggleMaximizeWindow}
