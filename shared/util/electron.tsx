// Capabilities we need from the node process. The preload fetches the constants synchronously from main and
// exposes them with the functions as globalThis._fromPreload before any page script runs; in the main process
// the preload module sets the same global directly.
import type {Actions} from '../constants/remote-actions'
import type * as RPCTypes from '@/constants/rpc/rpc-gen'

export type OpenDialogOptions = {
  allowFiles?: boolean
  allowDirectories?: boolean
  allowMultiselect?: boolean
  buttonLabel?: string
  defaultPath?: string
  filters?: Array<{extensions: Array<string>; name: string}>
  message?: string
  title?: string
}

export type SaveDialogOptions = {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  message?: string
}

import type {RPCMessage as EngineRPCMessage} from '@/engine/rpc-transport'
// The node relay's link to the service came up or went down. `epoch` names that connection: it
// goes up by one on every connect.
export type EngineLinkFrame = {type: 'link'; up: boolean; epoch: number}
// A renderer write, stamped with the connection it was made on
export type EngineSend = {epoch: number; message: EngineRPCMessage}

// The channels main sends to a renderer; the preload refuses to subscribe to any other
export const rendererChannels = ['KBdispatchAction', 'KBnotification', 'KBprops', 'engineIncoming'] as const
export type RendererChannel = (typeof rendererChannels)[number]
export const isRendererChannel = (channel: unknown): channel is RendererChannel =>
  rendererChannels.some(c => c === channel)

// A notification the main process shows for the main window. `groupId` gathers a conversation's
// notifications so they can be cleared together.
export type DesktopNotification = {
  body: string
  groupId?: string
  groupTitle?: string
  hasReply: boolean
  id: string
  silent: boolean
  title: string
}
// What the person did with a notification, sent back to the main window on KBnotification
export type DesktopNotificationEvent =
  | {type: 'click' | 'close'; id: string}
  | {type: 'reply'; id: string; reply: string}

export type KB2 = {
  constants: {
    assetRoot: string
    configOverload: object
    dokanPath: string
    downloadFolder: string
    env: {
      APPDATA: string
      HOME: string
      KEYBASE_AUTOSTART: string
      KEYBASE_CRASH_REPORT: string
      KEYBASE_DEVEL_USE_XDG: string
      KEYBASE_RESTORE_UI: string
      KEYBASE_RUN_MODE: string
      KEYBASE_START_UI: string
      KEYBASE_XDG_OVERRIDE: string
      LANG: string
      LC_ALL: string
      LC_TIME: string
      LOCALAPPDATA: string
      XDG_CACHE_HOME: string
      XDG_CONFIG_HOME: string
      XDG_DATA_HOME: string
      XDG_DOWNLOAD_DIR: string
      XDG_RUNTIME_DIR: string
    }
    helloDetails: {
      argv: Array<string>
      clientType: 2 // RPCTypes.ClientType.guiMain,
      desc: 'Main Renderer'
      pid: number
      version: string
    }
    isRenderer: boolean
    // host of the local file scheme's URLs for this launch; see util/file-url.tsx
    localFileHost: string
    pathSep: '/' | '\\'
    platform: 'win32' | 'darwin' | 'linux'
    startDarkMode: boolean
    windowsBinPath: string
  }
  functions: {
    engineSend?: (send: EngineSend) => void
    // The relay drops its connection to the service and makes a fresh one
    engineRestartLink?: () => void
    // The relay drops its connection to the service and does not reconnect until the renderer reloads
    engineDropLink?: () => void
    appStartedUp?: () => Promise<void>
    isDirectory?: (path: string) => Promise<boolean>
    getPathForFile?: (file: File) => string
    activeChanged?: (changedAtMs: number, isUserActive: boolean) => void
    clearNotificationGroup?: (groupId: string) => void
    closeWindow?: () => void
    showContextMenu?: (url: string) => void
    installCachedDokan?: () => Promise<void>
    uninstallDokan?: (execPath: string) => Promise<void>
    dumpNodeLogger?: () => Promise<void>
    ipcRendererOn?: (channel: RendererChannel, cb: (data: unknown) => void) => (() => void) | undefined
    hideWindow?: () => void
    getPathType?: (path: string) => Promise<'file' | 'directory'>
    getRemoteProps?: (windowComponent: string, windowParam: string) => Promise<string>
    // defined for both always
    mainWindowDispatch: (action: Actions) => void
    mainWindowDispatchEngineIncoming?: (data: Uint8Array | EngineLinkFrame) => void
    darwinCopyToChatTempUploadFile?: (dst: string, originalFilePath: string) => Promise<void>
    darwinCopyToKBFSTempUploadFile?: (dir: string, originalFilePath: string) => Promise<string>
    minimizeWindow?: () => void
    openPathInFinder?: (path: string, isFolder: boolean) => Promise<void>
    openURL?: (url: string) => Promise<void>
    requestWindowsStartService?: () => void
    rendererNewProps?: (options: {propsStr: string; windowComponent: string; windowParam: string}) => void
    makeRenderer?: (options: {
      windowComponent: string
      windowOpts: {
        hasShadow?: boolean
        height: number
        transparent?: boolean
        width: number
      }
      windowParam?: string
      windowPositionBottomRight?: boolean
    }) => void
    closeRenderer?: (options: {windowComponent?: string; windowParam?: string}) => void
    readImageFromClipboard?: () => Promise<Uint8Array | undefined>
    setOpenAtLogin?: (enabled: boolean) => Promise<void>
    setNativeTheme?: (theme: 'dark' | 'light' | 'system') => Promise<void>
    showOpenDialog?: (options: OpenDialogOptions) => Promise<Array<string>>
    showSaveDialog?: (options: SaveDialogOptions) => Promise<string>
    showTray?: (desktopAppBadgeCount: number, badgeType: 'regular' | 'update' | 'error' | 'uploading') => void
    showInactive?: () => void
    showNotification?: (notification: DesktopNotification) => void
    showMainWindow?: () => void
    toggleMaximizeWindow?: () => void
    winCheckRPCOwnership?: () => Promise<void>
    windowsCheckMountFromOtherDokanInstall?: (
      mountPoint: string,
      status: RPCTypes.FuseStatus
    ) => Promise<RPCTypes.FuseStatus>
    quitApp?: () => void
    exitApp?: (code: number) => void
    copyToClipboard?: (text: string) => void
    DEVwriteMenuIcons?: () => void
    ctlQuit?: () => void
    relaunchApp?: () => void
    uninstallKBFSDialog?: () => Promise<boolean>
    uninstallDokanDialog?: () => Promise<void>
    selectFilesToUploadDialog?: (
      type: 'file' | 'directory' | 'both',
      parent?: string
    ) => Promise<Array<string>>
  }
}

// ─── Desktop implementation ────────────────────────────────────────────────

const getStashed = (): KB2 => {
  if (!globalThis._fromPreload) throw new Error('KB2 not injected!')
  return globalThis._fromPreload as KB2
}

const desktopKB2: KB2 = {
  get constants() {
    return getStashed().constants
  },
  get functions() {
    return getStashed().functions
  },
}

// Native stub — only the subset of functions available on mobile.
// Typed as KB2 so callers don't need to narrow; they guard with isMobile at runtime.
const nativeKB2: KB2 = {
  functions: {
    darwinCopyToChatTempUploadFile: undefined,
    getPathForFile: undefined,
    isDirectory: undefined,
    setNativeTheme: undefined,
    mainWindowDispatch: (_action) => {},
  },
  get constants(): KB2['constants'] {
    throw new Error('KB2.constants is not available on mobile')
  },
}

const theKB2: KB2 = isMobile ? nativeKB2 : desktopKB2
export default theKB2
