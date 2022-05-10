import * as Electron from 'electron'
import type {TypedActions} from '../../actions/typed-actions-gen'
import {
  injectPreload,
  type KB2,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from '../../util/electron.desktop'
import type {LogLineWithLevelISOTimestamp} from '../../logger/types'

const isRenderer = process.type === 'renderer'
const isDarwin = process.platform === 'darwin'

// TODO contextBridge
if (isRenderer) {
  Electron.ipcRenderer
    .invoke('KBkeybase', {type: 'setupPreloadKB2'})
    .then((kb2consts: KB2['constants']) => {
      injectPreload({
        constants: {
          ...kb2consts,
          // kb2impl is from node's perspective so isRenderer is incorrect for the other side
          isRenderer: true,
        },
        functions: {
          activeChanged: (changedAtMs: number, isUserActive: boolean) => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {
                payload: {changedAtMs, isUserActive},
                type: 'activeChanged',
              })
              .then(() => {})
              .catch(() => {})
          },
          closeRenderer: (options: {windowComponent?: string; windowParam?: string}) => {
            const {windowComponent, windowParam} = options
            Electron.ipcRenderer
              .invoke('KBkeybase', {
                payload: {
                  windowComponent,
                  windowParam,
                },
                type: 'closeRenderer',
              })
              .then(() => {})
              .catch(() => {})
          },
          closeWindow: () => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'closeWindow'})
              .then(() => {})
              .catch(() => {})
          },
          ctlQuit: () => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'ctlQuit'})
              .then(() => {})
              .catch(() => {})
          },
          darwinCopyToChatTempUploadFile: async (dst: string, originalFilePath: string) => {
            if (!isDarwin) {
              throw new Error('Unsupported platform')
            }
            const res = (await Electron.ipcRenderer.invoke('KBkeybase', {
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
            return (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: {dir, originalFilePath},
              type: 'darwinCopyToKBFSTempUploadFile',
            })) as string
          },
          dumpNodeLogger: async () => {
            return (await Electron.ipcRenderer.invoke('KBkeybase', {
              type: 'dumpNodeLogger',
            })) as Array<LogLineWithLevelISOTimestamp>
          },
          exitApp: (code: number) => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {payload: {code}, type: 'exitApp'})
              .then(() => {})
              .catch(() => {})
          },
          getPathType: async (path: string) => {
            return (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: {path},
              type: 'getPathType',
            })) as 'file' | 'directory'
          },
          hideWindow: () => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'hideWindow'})
              .then(() => {})
              .catch(() => {})
          },
          mainWindowDispatch: (action: TypedActions) => {
            Electron.ipcRenderer
              .invoke('KBdispatchAction', action)
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
            Electron.ipcRenderer
              .invoke('KBkeybase', {
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
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'minimizeWindow'})
              .then(() => {})
              .catch(() => {})
          },
          openPathInFinder: async (path: string) => {
            const res = (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: {path},
              type: 'openPathInFinder',
            })) as boolean
            if (!res) {
              throw new Error('openInDefaultDirectory')
            }
          },
          openURL: async (url: string) => {
            const res = (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: {url},
              type: 'openURL',
            })) as boolean
            if (!res) {
              throw new Error('openURL failed')
            }
          },
          quitApp: () => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'quitApp'})
              .then(() => {})
              .catch(() => {})
          },
          relaunchApp: () => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'relaunchApp'})
              .then(() => {})
              .catch(() => {})
          },
          rendererNewProps: (options: {propsStr: string; windowComponent: string; windowParam: string}) => {
            const {propsStr, windowComponent, windowParam} = options
            Electron.ipcRenderer
              .invoke('KBkeybase', {
                payload: {propsStr, windowComponent, windowParam},
                type: 'rendererNewProps',
              })
              .then(() => {})
              .catch(() => {})
          },
          requestWindowsStartService: () => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'requestWindowsStartService'})
              .then(() => {})
              .catch(() => {})
          },
          selectFilesToUploadDialog: async (type: 'file' | 'directory' | 'both', parent: string | null) => {
            return Electron.ipcRenderer.invoke('KBkeybase', {
              payload: {parent, type},
              type: 'selectFilesToUploadDialog',
            })
          },
          setOpenAtLogin: async (enabled: boolean) => {
            return Electron.ipcRenderer.invoke('KBkeybase', {payload: {enabled}, type: 'setOpenAtLogin'})
          },
          showInactive: () => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'showInactive'})
              .then(() => {})
              .catch(() => {})
          },
          showMainWindow: () => {
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'showMainWindow'})
              .then(() => {})
              .catch(() => {})
          },
          showOpenDialog: async (options?: OpenDialogOptions) => {
            return (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: options,
              type: 'showOpenDialog',
            })) as Array<string>
          },
          showSaveDialog: async (options?: SaveDialogOptions) => {
            return (await Electron.ipcRenderer.invoke('KBkeybase', {
              payload: options,
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
            Electron.ipcRenderer
              .invoke('KBkeybase', {type: 'toggleMaximizeWindow'})
              .then(() => {})
              .catch(() => {})
          },
          uninstallDokanDialog: async () => {
            return Electron.ipcRenderer.invoke('KBkeybase', {type: 'uninstallDokanDialog'})
          },
          uninstallKBFSDialog: async () => {
            return Electron.ipcRenderer.invoke('KBkeybase', {type: 'uninstallKBFSDialog'})
          },

          winCheckRPCOwnership: async () => {
            const res = (await Electron.ipcRenderer.invoke('KBkeybase', {
              type: 'winCheckRPCOwnership',
            })) as boolean
            if (!res) {
              throw new Error('RPCCheck failed!')
            }
          },
        },
      })
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
  injectPreload({
    constants: kb2consts,
    functions: {
      mainWindowDispatch: (action: TypedActions) => {
        getMainWindow()?.webContents.send('KBdispatchAction', action)
      },
    },
  })
}
