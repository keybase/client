// TODO deprecate and replace with contextbridge / messages
// Helps deal with loading common things from remote.
import * as Electron from 'electron'

const remote = KB.constants.isRenderer ? require('@electron/remote') : null

// Main thread only, proxy through remote
export const getApp = () => {
  const app = KB.constants.isRenderer ? remote.app : Electron.app
  if (!app) {
    throw new Error('Should be impossible')
  }
  return app
}

// some kind of electron bug
// https://github.com/electron/electron/issues/19125
export const workingIsDarkMode = () => {
  return (
    KB.constants.isDarwin && getSystemPreferences().getUserDefault('AppleInterfaceStyle', 'string') == 'Dark'
  )
}

export const getSystemPreferences = () => {
  const systemPreferences = KB.constants.isRenderer ? remote.systemPreferences : Electron.systemPreferences
  if (!systemPreferences) {
    throw new Error('Should be impossible')
  }
  return systemPreferences
}

// Both

// Expose classes
const _BrowserWindow = Electron.BrowserWindow || (remote && remote.BrowserWindow)
if (!_BrowserWindow) {
  throw new Error('Should be impossible')
}
export const BrowserWindow = _BrowserWindow
const _Menu = Electron.Menu || (remote && remote.Menu)
if (!_Menu) {
  throw new Error('Should be impossible')
}
export const Menu = _Menu
export type BrowserWindowType = Electron.BrowserWindow
