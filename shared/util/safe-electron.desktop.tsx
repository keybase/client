// TODO deprecate
// Helps deal with loading common things from remote.
import * as Electron from 'electron'

const {process} = KB

// Main thread only, proxy through remote
export const getApp = () => {
  const app = Electron.app || getRemote().app
  if (!app) {
    throw new Error('Should be impossible')
  }
  return app
}

// some kind of electron bug
// https://github.com/electron/electron/issues/19125
export const workingIsDarkMode = () => {
  const platform = process.platform
  const isDarwin = platform === 'darwin'
  return isDarwin && getSystemPreferences().getUserDefault('AppleInterfaceStyle', 'string') == 'Dark'
}

export const getSystemPreferences = () => {
  const systemPreferences = Electron.systemPreferences || getRemote().systemPreferences
  if (!systemPreferences) {
    throw new Error('Should be impossible')
  }
  return systemPreferences
}

// Both

// Expose classes
const _BrowserWindow = Electron.BrowserWindow || (Electron.remote && Electron.remote.BrowserWindow)
if (!_BrowserWindow) {
  throw new Error('Should be impossible')
}
export const BrowserWindow = _BrowserWindow
const _Menu = Electron.Menu || (Electron.remote && Electron.remote.Menu)
if (!_Menu) {
  throw new Error('Should be impossible')
}
export const Menu = _Menu
export type BrowserWindowType = Electron.BrowserWindow
