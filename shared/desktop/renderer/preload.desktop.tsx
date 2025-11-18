import * as Electron from 'electron'
import type {Actions} from '@/actions/remote-gen'
import {
  injectPreload,
  type KB2,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from '@/util/electron.desktop'
import type * as RPCTypes from '@/constants/types/rpc-gen'
import type {Action} from '../app/ipctypes'

const isRenderer = process.type === 'renderer'
const isDarwin = process.platform === 'darwin'

const ignorePromise = (f: Promise<unknown>) => {
  f.then(() => {}).catch(() => {})
}

async function invoke<F>(action: Action) {
  return Electron.ipcRenderer.invoke('KBkeybase', action) as Promise<F>
}

if (isRenderer) {
  Electron.ipcRenderer
    .invoke('KBkeybase', {type: 'setupPreloadKB2'})
    .then((kb2consts: KB2['constants']) => {
      const functions: Required<KB2['functions']> = {
        DEVwriteMenuIcons: () => {
          ignorePromise(invoke({type: 'DEVwriteMenuIcons'}))
        },
        activeChanged: (changedAtMs: number, isUserActive: boolean) => {
          ignorePromise(invoke({payload: {changedAtMs, isUserActive}, type: 'activeChanged'}))
        },
        appStartedUp: () => {
          ignorePromise(invoke({type: 'appStartedUp'}))
        },
        clipboardAvailableFormats: async () => {
          return invoke({type: 'clipboardAvailableFormats'})
        },
        closeRenderer: (options: {windowComponent?: string; windowParam?: string}) => {
          const {windowComponent, windowParam} = options
          ignorePromise(invoke({payload: {windowComponent, windowParam}, type: 'closeRenderer'}))
        },
        closeWindow: () => {
          ignorePromise(invoke({type: 'closeWindow'}))
        },
        copyToClipboard: (text: string) => {
          ignorePromise(invoke({payload: {text}, type: 'copyToClipboard'}))
        },
        ctlQuit: () => {
          ignorePromise(invoke({type: 'ctlQuit'}))
        },
        darwinCopyToChatTempUploadFile: async (dst: string, originalFilePath: string) => {
          if (!isDarwin) {
            throw new Error('Unsupported platform')
          }
          const res = await invoke({
            payload: {dst, originalFilePath},
            type: 'darwinCopyToChatTempUploadFile',
          })
          if (!res) {
            throw new Error("Couldn't save")
          }
        },
        darwinCopyToKBFSTempUploadFile: async (dir: string, originalFilePath: string) => {
          if (!isDarwin) return ''
          return await invoke({
            payload: {dir, originalFilePath},
            type: 'darwinCopyToKBFSTempUploadFile',
          })
        },
        dumpNodeLogger: async () => {
          await invoke({
            type: 'dumpNodeLogger',
          })
        },
        engineSend: (buf: Uint8Array) => {
          ignorePromise(invoke({payload: {buf}, type: 'engineSend'}))
        },
        exitApp: (code: number) => {
          ignorePromise(invoke({payload: {code}, type: 'exitApp'}))
        },
        getPathForFile: (file: File) => {
          return Electron.webUtils.getPathForFile(file)
        },
        getPathType: async (path: string) => {
          return await invoke({
            payload: {path},
            type: 'getPathType',
          })
        },
        hideWindow: () => {
          ignorePromise(invoke({type: 'hideWindow'}))
        },
        installCachedDokan: async () => {
          try {
            await invoke({type: 'installCachedDokan'})
            return
          } catch {
            throw new Error('installCachedDokan fail')
          }
        },
        ipcRendererOn: (channel: string, cb: (event: unknown, action: unknown) => void) => {
          Electron.ipcRenderer.on(channel, cb)
        },
        isDirectory: async (path: string) => {
          return invoke({payload: {path}, type: 'isDirectory'})
        },
        mainWindowDispatch: (action: Actions) => {
          ignorePromise(Electron.ipcRenderer.invoke('KBdispatchAction', action))
        },
        mainWindowDispatchEngineIncoming: (data: Uint8Array) => {
          ignorePromise(Electron.ipcRenderer.invoke('engineIncoming', data))
        },
        makeRenderer: (options: {
          windowComponent: string
          windowOpts: {
            hasShadow?: boolean
            height: number
            transparent?: boolean
            width: number
          }
          windowParam?: string
          windowPositionBottomRight?: boolean
        }) => {
          const {windowComponent, windowOpts, windowParam, windowPositionBottomRight} = options
          ignorePromise(
            invoke({
              payload: {
                windowComponent,
                windowOpts,
                windowParam,
                windowPositionBottomRight,
              },
              type: 'makeRenderer',
            })
          )
        },
        minimizeWindow: () => {
          ignorePromise(invoke({type: 'minimizeWindow'}))
        },
        openPathInFinder: async (path: string, isFolder: boolean) => {
          const res = await invoke({
            payload: {isFolder, path},
            type: 'openPathInFinder',
          })
          if (!res) {
            throw new Error('openInDefaultDirectory')
          }
        },
        openURL: async (url: string) => {
          const res = await invoke({
            payload: {url},
            type: 'openURL',
          })
          if (!res) {
            throw new Error('openURL failed')
          }
        },
        quitApp: () => {
          ignorePromise(invoke({type: 'quitApp'}))
        },
        readImageFromClipboard: async () => {
          return invoke({type: 'readImageFromClipboard'})
        },
        relaunchApp: () => {
          ignorePromise(invoke({type: 'relaunchApp'}))
        },
        rendererNewProps: (options: {propsStr: string; windowComponent: string; windowParam: string}) => {
          const {propsStr, windowComponent, windowParam} = options
          ignorePromise(
            invoke({
              payload: {propsStr, windowComponent, windowParam},
              type: 'rendererNewProps',
            })
          )
        },
        requestWindowsStartService: () => {
          ignorePromise(invoke({type: 'requestWindowsStartService'}))
        },
        selectFilesToUploadDialog: async (type: 'file' | 'directory' | 'both', parent?: string) => {
          return invoke({
            payload: {parent, type},
            type: 'selectFilesToUploadDialog',
          })
        },
        setOpenAtLogin: async (enabled: boolean) => {
          return invoke({payload: {enabled}, type: 'setOpenAtLogin'})
        },
        showContextMenu: (url: string) => {
          ignorePromise(invoke({payload: {url}, type: 'showContextMenu'}))
        },
        showInactive: () => {
          ignorePromise(invoke({type: 'showInactive'}))
        },
        showMainWindow: () => {
          ignorePromise(invoke({type: 'showMainWindow'}))
        },
        showOpenDialog: async (options: OpenDialogOptions) => {
          return await invoke({
            payload: {options},
            type: 'showOpenDialog',
          })
        },
        showSaveDialog: async (options: SaveDialogOptions) => {
          return await invoke({
            payload: {options},
            type: 'showSaveDialog',
          })
        },
        showTray: (desktopAppBadgeCount: number, badgeType: 'regular' | 'update' | 'error' | 'uploading') => {
          ignorePromise(
            Electron.ipcRenderer.invoke('KBmenu', {
              payload: {badgeType, desktopAppBadgeCount},
              type: 'showTray',
            })
          )
        },
        toggleMaximizeWindow: () => {
          ignorePromise(invoke({type: 'toggleMaximizeWindow'}))
        },
        uninstallDokan: async (execPath: string) => {
          return invoke({payload: {execPath}, type: 'uninstallDokan'})
        },
        uninstallDokanDialog: async () => {
          return invoke({type: 'uninstallDokanDialog'})
        },
        uninstallKBFSDialog: async () => {
          return invoke({type: 'uninstallKBFSDialog'})
        },
        winCheckRPCOwnership: async () => {
          const res = await invoke({
            type: 'winCheckRPCOwnership',
          })
          if (!res) {
            throw new Error('RPCCheck failed!')
          }
        },
        windowsCheckMountFromOtherDokanInstall: async (mountPoint: string, status: RPCTypes.FuseStatus) => {
          return invoke({
            payload: {mountPoint, status},
            type: 'windowsCheckMountFromOtherDokanInstall',
          })
        },
      }

      // we have to stash this in a global due to how preload works, else it clears out the module level variables
      const kb2 = {
        constants: {
          ...kb2consts,
          // kb2impl is from node's perspective so isRenderer is incorrect for the other side
          isRenderer: true,
        },
        functions,
      }

      Electron.contextBridge.exposeInMainWorld('_fromPreload', kb2)
      injectPreload(kb2)
    })
    .catch((e: unknown) => {
      throw e
    })
} else {
  const {default: kb2consts} = require('../app/kb2-impl.desktop') as {default: KB2['constants']}
  const getMainWindow = () => {
    const e = require('electron')
    const w = e.BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('/main.'))
    return w
  }

  const kb2 = {
    constants: kb2consts,
    functions: {
      mainWindowDispatch: (action: Actions) => {
        getMainWindow()?.webContents.send('KBdispatchAction', action)
      },
      mainWindowDispatchEngineIncoming: (data: Uint8Array) => {
        getMainWindow()?.webContents.send('engineIncoming', data)
      },
    },
  }

  globalThis._fromPreload = kb2
  injectPreload(kb2)
}
