import * as Electron from 'electron'
import type {TypedActions} from '../../actions/typed-actions-gen'
import {
  injectPreload,
  type KB2,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from '../../util/electron.desktop'
import type * as RPCTypes from '../../constants/types/rpc-gen'
import type {Action} from '../app/ipctypes'

const isRenderer = process.type === 'renderer'
const isDarwin = process.platform === 'darwin'

const invoke = async (action: Action) => Electron.ipcRenderer.invoke('KBkeybase', action)

if (isRenderer) {
  Electron.ipcRenderer
    .invoke('KBkeybase', {type: 'setupPreloadKB2'})
    .then((kb2consts: KB2['constants']) => {
      const functions: Required<KB2['functions']> = {
        activeChanged: (changedAtMs: number, isUserActive: boolean) => {
          invoke({payload: {changedAtMs, isUserActive}, type: 'activeChanged'})
            .then(() => {})
            .catch(() => {})
        },
        appStartedUp: () => {
          invoke({type: 'appStartedUp'})
            .then(() => {})
            .catch(() => {})
        },
        clipboardAvailableFormats: async () => {
          return invoke({type: 'clipboardAvailableFormats'})
        },
        closeRenderer: (options: {windowComponent?: string; windowParam?: string}) => {
          const {windowComponent, windowParam} = options
          invoke({payload: {windowComponent, windowParam}, type: 'closeRenderer'})
            .then(() => {})
            .catch(() => {})
        },
        closeWindow: () => {
          invoke({type: 'closeWindow'})
            .then(() => {})
            .catch(() => {})
        },
        copyToClipboard: (text: string) => {
          invoke({payload: {text}, type: 'copyToClipboard'})
            .then(() => {})
            .catch(() => {})
        },
        ctlQuit: () => {
          invoke({type: 'ctlQuit'})
            .then(() => {})
            .catch(() => {})
        },
        darwinCopyToChatTempUploadFile: async (dst: string, originalFilePath: string) => {
          if (!isDarwin) {
            throw new Error('Unsupported platform')
          }
          const res = (await invoke({
            payload: {dst, originalFilePath},
            type: 'darwinCopyToChatTempUploadFile',
          })) as boolean
          if (res) {
            return
          } else {
            throw new Error("Couldn't save")
          }
        },
        darwinCopyToKBFSTempUploadFile: async (dir: string, originalFilePath: string) => {
          if (!isDarwin) return ''
          return (await invoke({
            payload: {dir, originalFilePath},
            type: 'darwinCopyToKBFSTempUploadFile',
          })) as string
        },
        dumpNodeLogger: async () => {
          await invoke({
            type: 'dumpNodeLogger',
          })
        },
        engineSend: (buf: unknown) => {
          // @ts-ignore
          invoke({payload: {buf}, type: 'engineSend'})
            .then(() => {})
            .catch(() => {})
        },
        exitApp: (code: number) => {
          invoke({payload: {code}, type: 'exitApp'})
            .then(() => {})
            .catch(() => {})
        },
        getPathType: async (path: string) => {
          return (await invoke({
            payload: {path},
            type: 'getPathType',
          })) as 'file' | 'directory'
        },
        hideWindow: () => {
          invoke({type: 'hideWindow'})
            .then(() => {})
            .catch(() => {})
        },
        installCachedDokan: async () => {
          try {
            await invoke({type: 'installCachedDokan'})
            return
          } catch {
            throw new Error('installCachedDokan fail')
          }
        },
        ipcRendererOn: (channel: string, cb: (event: any, action: any) => void) => {
          Electron.ipcRenderer.on(channel, cb)
        },
        isDirectory: async (path: string) => {
          return invoke({payload: {path}, type: 'isDirectory'})
        },
        mainWindowDispatch: (action: TypedActions, nodeTypeOverride?: string) => {
          Electron.ipcRenderer
            .invoke(nodeTypeOverride ?? 'KBdispatchAction', action)
            .then(() => {})
            .catch(() => {})
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
          invoke({
            payload: {
              windowComponent,
              windowOpts,
              windowParam,
              windowPositionBottomRight,
            },
            type: 'makeRenderer',
          })
            .then(() => {})
            .catch(() => {})
        },
        minimizeWindow: () => {
          invoke({type: 'minimizeWindow'})
            .then(() => {})
            .catch(() => {})
        },
        openPathInFinder: async (path: string, isFolder: boolean) => {
          const res = (await invoke({
            payload: {isFolder, path},
            type: 'openPathInFinder',
          })) as boolean
          if (!res) {
            throw new Error('openInDefaultDirectory')
          }
        },
        openURL: async (url: string) => {
          const res = (await invoke({
            payload: {url},
            type: 'openURL',
          })) as boolean
          if (!res) {
            throw new Error('openURL failed')
          }
        },
        quitApp: () => {
          invoke({type: 'quitApp'})
            .then(() => {})
            .catch(() => {})
        },
        readImageFromClipboard: async () => {
          return invoke({type: 'readImageFromClipboard'})
        },
        relaunchApp: () => {
          invoke({type: 'relaunchApp'})
            .then(() => {})
            .catch(() => {})
        },
        rendererNewProps: (options: {propsStr: string; windowComponent: string; windowParam: string}) => {
          const {propsStr, windowComponent, windowParam} = options
          invoke({
            payload: {propsStr, windowComponent, windowParam},
            type: 'rendererNewProps',
          })
            .then(() => {})
            .catch(() => {})
        },
        requestWindowsStartService: () => {
          invoke({type: 'requestWindowsStartService'})
            .then(() => {})
            .catch(() => {})
        },
        selectFilesToUploadDialog: async (type: 'file' | 'directory' | 'both', parent: string | null) => {
          return invoke({
            payload: {parent, type},
            type: 'selectFilesToUploadDialog',
          })
        },
        setOpenAtLogin: async (enabled: boolean) => {
          return invoke({payload: {enabled}, type: 'setOpenAtLogin'})
        },
        showContextMenu: (url: string) => {
          invoke({payload: {url}, type: 'showContextMenu'})
            .then(() => {})
            .catch(() => {})
        },
        showInactive: () => {
          invoke({type: 'showInactive'})
            .then(() => {})
            .catch(() => {})
        },
        showMainWindow: () => {
          invoke({type: 'showMainWindow'})
            .then(() => {})
            .catch(() => {})
        },
        showOpenDialog: async (options: OpenDialogOptions) => {
          return (await invoke({
            payload: {options},
            type: 'showOpenDialog',
          })) as Array<string>
        },
        showSaveDialog: async (options: SaveDialogOptions) => {
          return (await invoke({
            payload: {options},
            type: 'showSaveDialog',
          })) as string
        },
        showTray: (desktopAppBadgeCount: number, icon: string) => {
          Electron.ipcRenderer
            .invoke('KBmenu', {
              payload: {desktopAppBadgeCount, icon},
              type: 'showTray',
            })
            .then(() => {})
            .catch(() => {})
        },
        toggleMaximizeWindow: () => {
          invoke({type: 'toggleMaximizeWindow'})
            .then(() => {})
            .catch(() => {})
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
          const res = (await invoke({
            type: 'winCheckRPCOwnership',
          })) as boolean
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
    .catch(e => {
      throw e
    })
} else {
  const kb2consts = require('../app/kb2-impl.desktop').default
  const getMainWindow = (): Electron.BrowserWindow | null => {
    const w = require('electron')
      .BrowserWindow.getAllWindows()
      .find(w => w.webContents.getURL().includes('/main.'))
    return w || null
  }

  const kb2 = {
    constants: kb2consts,
    functions: {
      mainWindowDispatch: (action: TypedActions, nodeTypeOverride?: string) => {
        getMainWindow()?.webContents.send(nodeTypeOverride ?? 'KBdispatchAction', action)
      },
    },
  }

  globalThis._fromPreload = kb2
  injectPreload(kb2)
}
