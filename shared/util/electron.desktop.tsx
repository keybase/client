// There are capabilities we need from the node process that need to be plumbed through. In order to simplify our code internally
// instead of having a lot of async logic getting some static values we instead wait to load these values on start before we
// start drawing. If you need access to these values you need to call `waitOnKB2Loaded`
// the electron preload scripts will create kb2 on the node side and plumb it back and then call `injectPreload`
import type {TypedActions} from '../actions/typed-actions-gen'
import type * as RPCTypes from '../constants/types/rpc-gen'

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
    pathSep: '/' | '\\'
    platform: 'win32' | 'darwin' | 'linux'
    startDarkMode: boolean
    windowsBinPath: string
  }
  functions: {
    engineSend?: (buff: unknown) => void
    appStartedUp?: () => void
    isDirectory?: (path: string) => Promise<boolean>
    activeChanged?: (changedAtMs: number, isUserActive: boolean) => void
    closeWindow?: () => void
    showContextMenu?: (url: string) => void
    installCachedDokan?: () => Promise<void>
    uninstallDokan?: (execPath: string) => Promise<void>
    dumpNodeLogger?: () => Promise<void>
    ipcRendererOn?: (channel: string, cb: (event: any, action: any) => void) => void
    hideWindow?: () => void
    getPathType?: (path: string) => Promise<'file' | 'directory'>
    // defined for both always
    mainWindowDispatch: (action: TypedActions, nodeTypeOverride?: string) => void
    darwinCopyToChatTempUploadFile?: (dst: string, originalFilePath: string) => Promise<void>
    darwinCopyToKBFSTempUploadFile?: (dir: string, originalFilePath: string) => Promise<string>
    minimizeWindow?: () => void
    openPathInFinder?: (path: string, isFolder: boolean) => Promise<void>
    openURL?: (url: string, options?: {activate: boolean}) => Promise<void>
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
    readImageFromClipboard?: () => Promise<Buffer | null>
    setOpenAtLogin?: (enabled: boolean) => Promise<void>
    showOpenDialog?: (options: OpenDialogOptions) => Promise<Array<string>>
    showSaveDialog?: (options: SaveDialogOptions) => Promise<string>
    showTray?: (desktopAppBadgeCount: number, icon: string) => void
    showInactive?: () => void
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
    clipboardAvailableFormats?: () => Promise<Array<string>>
    ctlQuit?: () => void
    relaunchApp?: () => void
    uninstallKBFSDialog?: () => Promise<boolean>
    uninstallDokanDialog?: () => Promise<void>
    selectFilesToUploadDialog?: (
      type: 'file' | 'directory' | 'both',
      parent: string | null
    ) => Promise<Array<string>>
  }
}

const kb2Waiters = new Array<() => void>()

export const injectPreload = (kb2: KB2) => {
  if (!kb2 || !kb2?.constants?.assetRoot) {
    throw new Error('Invalid kb2 injected')
  }

  while (kb2Waiters.length) {
    kb2Waiters.shift()?.()
  }
}

export const waitOnKB2Loaded = (cb: () => void) => {
  if (globalThis._fromPreload) {
    cb()
  } else {
    kb2Waiters.push(cb)
  }
}

const getStashed = () => {
  if (!globalThis._fromPreload) throw new Error('KB2 not injected!')
  return globalThis._fromPreload as KB2
}

const theKB2: KB2 = {
  get constants() {
    return getStashed().constants
  },
  get functions() {
    return getStashed().functions
  },
}

export default theKB2
