import * as Electron from 'electron'
import child_process from 'child_process'
import fs from 'fs'
import os from 'os'
import * as path from 'path'
import punycode from 'punycode'
import buffer from 'buffer'
import framedMsgpackRpc from 'framed-msgpack-rpc'
import purepack from 'purepack'

const platform = process.platform
const isDarwin = platform === 'darwin'
// const isWindows = platform === 'win32'
// const isLinux = platform === 'linux'
const isRenderer = typeof process !== 'undefined' && process.type === 'renderer'
const target = isRenderer ? window : global

const getWindow = (key: string): Electron.BrowserWindow | undefined => {
  let all: Array<Electron.BrowserWindow>
  if (isRenderer) {
    all = Electron.remote.BrowserWindow.getAllWindows()
  } else {
    all = Electron.BrowserWindow.getAllWindows()
  }
  return all.find(w => w.webContents.getURL().indexOf(key) !== -1)
}
const getMainWindow = () => getWindow('/main.')

const renderToMain = (payload: any) => {
  if (isRenderer) {
    Electron.ipcRenderer.send('KBkeybase', payload)
  } else {
    throw new Error('cant send from main renderToMain ')
  }
}
const anyToMainDispatchAction = (action: any) => {
  const mw = getMainWindow()
  if (mw) {
    const {webContents} = mw
    if (webContents) {
      webContents.send('KBdispatchAction', action)
    } else {
      throw new Error('no web contents: anyToMainDispatchAction')
    }
  } else {
    throw new Error('no web browser: anyToMainDispatchAction')
  }
}
const rendererToMainMenu = (payload: any) => {
  if (isRenderer) {
    Electron.ipcRenderer.send('KBmenu', payload)
  } else {
    throw new Error('cant send from main renderToMain ')
  }
}
const handleRendererToMainMenu = (cb: (payload: any) => void) => {
  Electron.ipcMain.on('KBmenu', (_event: any, payload: any) => {
    cb(payload)
  })
}

const handleRenderToMain = (cb: (payload: any) => void) => {
  Electron.ipcMain.on('KBkeybase', (_event: any, payload: any) => {
    cb(payload)
  })
}
const handleAnyToMainDispatchAction = (cb: (action: any) => void) => {
  Electron.ipcRenderer.on('KBdispatchAction', (_event: any, payload: any) => {
    cb(payload)
  })
}

const isDarkMode = () => isDarwin && Electron.remote.systemPreferences.isDarkMode()

const handleDarkModeChanged = (cb: (darkMode: boolean) => void) => {
  const sub =
    isDarwin && isRenderer
      ? Electron.remote.systemPreferences.subscribeNotification
      : Electron.systemPreferences.subscribeNotification
  if (sub) {
    return sub('AppleInterfaceThemeChangedNotification', () => {
      cb(isDarkMode())
    })
  }
  return -1
}

const unhandleDarkModeChanged = (id: undefined | number) => {
  if (id !== undefined) {
    const unsub = isDarwin && Electron.systemPreferences.unsubscribeNotification
    unsub && unsub(id)
  }
}

const showMessageBox = (options: any, cb: (r: number) => void) => {
  if (isRenderer) {
    Electron.remote.dialog.showMessageBox(options, cb)
  } else {
    Electron.dialog.showMessageBox(options, cb)
  }
}

const showOpenDialog = (options: any, cb: (filePaths?: string[], bookmarks?: string[]) => void) => {
  const w = Electron.remote.getCurrentWindow()
  Electron.remote.dialog.showOpenDialog(w, options, cb)
}

const handlePowerMonitor = (cb: (type: string) => void) => {
  const pm = Electron.remote.powerMonitor
  pm.on('suspend', () => cb('suspend'))
  pm.on('resume', () => cb('resume'))
  pm.on('shutdown', () => cb('shutdown'))
  pm.on('lock-screen', () => cb('lock-screen'))
  pm.on('unlock-screen', () => cb('unlock-screen'))
}

const mainLoggerDump = () => {
  if (isRenderer) {
    const d = Electron.remote.getGlobal('KB').mainLoggerDump
    return d ? d() : Promise.resolve([])
  } else {
    // set globally by node process
  }
}

const showMainWindow = (show: boolean) => {
  const mw = getMainWindow()
  if (mw) {
    if (show) {
      mw.show()
    } else {
      mw.hide()
    }
  }
}

const _handleMainWindowShownListeners = new Set<(shown: boolean) => void>()
let _handleMainWindowShownInited: boolean = false
const handleMainWindowShown = (cb: (shown: boolean) => void) => {
  _handleMainWindowShownListeners.add(cb)

  if (!_handleMainWindowShownInited) {
    const mw = getMainWindow()
    const onShow = () => {
      _handleMainWindowShownListeners.forEach(l => l(true))
    }
    const onHide = () => {
      _handleMainWindowShownListeners.forEach(l => l(false))
    }
    if (mw) {
      mw.on('show', onShow)
      mw.on('hide', onHide)
    }
    _handleMainWindowShownInited = true
  }
}

const unhandleMainWindowShown = (cb: (shown: boolean) => void) => {
  _handleMainWindowShownListeners.delete(cb)
}

const resizeWindow = (scrollHeight: number, offsetTop: number) => {
  const w = Electron.remote.getCurrentWindow()
  if (!w) return

  const originalResizableState = w.isResizable()
  w.setResizable(true)
  w.setContentSize(w.getSize()[0], scrollHeight + 2 * offsetTop + 2)
  w.setResizable(originalResizableState)
}

const showCurrentWindow = (show: boolean) => {
  const w = Electron.remote.getCurrentWindow()
  if (!w) return
  if (show) {
    w.showInactive()
  } else {
    w.close()
  }
}

// TODO deprecate
const netRequestHead = (
  url: string,
  onResponse: (m: Electron.IncomingMessage) => void,
  onError: (e: Error) => void
) => {
  const req = Electron.remote.net.request({method: 'HEAD', url})
  req.on('response', onResponse)
  req.on('error', onError)
  req.end()
}

const handleRemoteWindowProps = (cb: (s: string) => void) => {
  const w = Electron.remote.getCurrentWindow()
  if (!w) return
  w.on('KBprops' as any, cb)
}

const setOverlayIcon = (overlay: string) => {
  const mw = getMainWindow()
  if (!mw) return

  mw.setOverlayIcon(overlay as any, 'new activity')
}

const openURL = (url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return Electron.remote.shell.openExternal(url)
  }
  return Promise.reject()
}

const openOSXSecurityPrefs = () => {
  return Electron.remote.shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?General',
    {
      activate: true,
    }
  )
}

const openFinder = (path: string) => Electron.remote.shell.openItem(path)
const openFinderFolder = (path: string) => Electron.remote.shell.showItemInFolder(path)

target.KB = {
  // TODO deprecate
  __child_process: child_process,
  // TODO deprecate
  __dirname: __dirname,
  // TODO deprecate
  __electron: Electron,
  // TODO deprecate
  __fs: fs,
  // TODO deprecate
  __os: os,
  // TODO deprecate
  __path: path,
  // TODO deprecate
  __process: process,
  anyToMainDispatchAction,
  buffer,
  clipboard: {
    availableFormats:  Electron.clipboard.availableFormats,
    readImage: Electron.clipboard.readImage,
    writeText: Electron.clipboard.writeText,
  },
  framedMsgpackRpc,
  handleAnyToMainDispatchAction,
  handleDarkModeChanged,
  handleMainWindowShown,
  handlePowerMonitor,
  handleRemoteWindowProps,
  handleRenderToMain,
  handleRendererToMainMenu,
  isDarkMode,
  mainLoggerDump,
  netRequestHead,
  openOSXSecurityPrefs,
  openURL,
  openFinder,
  openFinderFolder,
  platform,
  punycode, // used by a dep
  purepack,
  remoteProcessPid: isRenderer ? Electron.remote.process.pid : process.pid,
  renderToMain,
  rendererToMainMenu,
  resizeWindow,
  setOverlayIcon,
  showCurrentWindow,
  showMainWindow,
  showMessageBox,
  showOpenDialog,
  unhandleDarkModeChanged,
  unhandleMainWindowShown,
}

if (isRenderer) {
  // target.KB = {
  // ...target.KB,
  // }

  // have to do this else electron blows away process
  setTimeout(() => {
    window.process = {
      env: process.env,
      platform: process.platform,
    }
  }, 0)
}
