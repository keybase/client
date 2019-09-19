// Helps deal with loading common things from remote.
const Electron = KB.__electron

// Main thread only, proxy through remote
export const getApp = () => {
  const app = Electron.app || getRemote().app
  if (!app) {
    throw new Error('Should be impossible')
  }
  return app
}

export const getRemote = () => {
  const remote = Electron.remote
  if (!remote) {
    throw new Error('Incorrect electron import. remote only available from render thread')
  }
  return remote
}

export const getCurrentWindowFromRemote = () => {
  return getRemote().getCurrentWindow()
}

// Both
export const getShell = () => {
  const shell = Electron.shell
  if (!shell) {
    throw new Error('Should be impossible')
  }
  return shell
}

export const getClipboard = () => {
  const clipboard = Electron.clipboard
  if (!clipboard) {
    throw new Error('Should be impossible')
  }
  return clipboard
}

export const getCrashReporter = () => {
  const crashReporter = Electron.crashReporter
  if (!crashReporter) {
    throw new Error('Should be impossible')
  }
  return crashReporter
}

export const getPowerSaveBlocker = () => {
  const powerSaveBlocker = Electron.powerSaveBlocker
  if (!powerSaveBlocker) {
    throw new Error('Should be impossible')
  }
  return powerSaveBlocker
}

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
