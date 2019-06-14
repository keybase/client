import {BrowserWindow} from './safe-electron.desktop'

const closeWindow = () => {
  const win = BrowserWindow && BrowserWindow.getFocusedWindow()
  win && win.close()
}
const isMaximized = () => {
  const win = BrowserWindow && BrowserWindow.getFocusedWindow()
  return win && win.isMaximized()
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

export {closeWindow, isMaximized, minimizeWindow, toggleMaximizeWindow}
