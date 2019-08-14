declare var __VERSION__: string
declare var __STORYBOOK__: boolean
declare var __STORYSHOT__: boolean

type Values<T extends object> = T[keyof T]

type Unpacked<T> = T extends (infer U)[]
  ? U
  : T extends (...args: any[]) => infer U
  ? U
  : T extends Promise<infer U>
  ? U
  : T

type RequestIdleCallbackHandle = any
type RequestIdleCallbackOptions = {
  timeout: number
}
type RequestIdleCallbackDeadline = {
  readonly didTimeout: boolean
  timeRemaining: () => number
}

interface Window {
  requestIdleCallback: (
    callback: (deadline: RequestIdleCallbackDeadline) => void,
    opts?: RequestIdleCallbackOptions
  ) => RequestIdleCallbackHandle
  cancelIdleCallback: (handle: RequestIdleCallbackHandle) => void
  DEBUGEffectById: any
  DEBUGLogSagas: any
  DEBUGLogSagasWithNames: any
  DEBUGRootEffects: any
  KB: typeof KB
}

interface Console {
  _log: any
  _warn: any
  _error: any
  _info: any
}

declare var KB: {
  __dirname: string
  crypto: {
    randomBytes: (size: number, callback: (err: Error | null, buf: Buffer) => void) => void
  }
  DEV?: any
  electron: {
    app: {
      emitCloseWindows: () => void
      exit: (code: number) => void
      getAppPath: () => string
    }
    browserWindow: {
      fromId: (id: number) => Electron.BrowserWindow | undefined
    }
    clipboard: {
      availableFormats: () => Array<string>
      readImage: () => Electron.NativeImage
    }
    currentWindow: {
      close: () => void
      hide: () => void
      onShow: (cb: () => void) => void
      popup: (m: Electron.Menu) => void
      removeListenerShow: (cb: () => void) => void
      webContents: {
        onContextMenu: (cb: (event: Electron.Event, params: Electron.ContextMenuParams) => void) => void
      }
    }
    ipcRenderer: {
      sendExecuteActions: (actions: Array<'closePopups' | 'quitMainWindow' | 'quitApp'>) => void
      sendShowTray: (icon: string, iconSelected: string, badgeCount: number) => void
    }
    ipcMain: {
      onExecuteActions: (cb: (...a: Array<any>) => void) => void
    }
    menu: {
      setApplicationMenu: (menu: Electron.Menu) => void
      buildFromTemplate: (
        template: Array<(Electron.MenuItemConstructorOptions) | (Electron.MenuItem)>
      ) => Electron.Menu
    }
    shell: {
      openExternal: (url: string) => Promise<void>
    }
    systemPreferences: {
      isDarkMode: () => boolean
      subscribeNotification: (event: string, callback: (event: string, userInfo: any) => void) => number
      unsubscribeNotification: (id: number) => void
    }
  }
  fs: {
    __: any
    access: (path: string, mode: number | undefined, cb: (err: NodeJS.ErrnoException) => void) => void
    constants: {F_OK: number}
    isDirectory: (path: string) => boolean
    readdir: (path: string, cb: (err: NodeJS.ErrnoException, files: Array<string>) => void) => void
    readJsonDebug: () => Object
    readServerConfig: () => Object
    realpath: (path: string, callback: (err: NodeJS.ErrnoException, resolvedPath: string) => void) => void
    stat: (
      path: string,
      cb: (
        err: NodeJS.ErrnoException,
        stats: {
          isFile: () => boolean
          isDirectory: () => boolean
        }
      ) => void
    ) => void
  }
  os: {
    homedir: () => string
  }
  path: {
    basename: (p: string, ext?: string | undefined) => string
    dirname: (p: string) => string
    extname: (p: string) => string
    isAbsolute: (p: string) => boolean
    join: (...pathSegments: Array<string>) => string
    resolve: (...pathSegments: Array<string>) => string
    sep: string
  }
  process: {
    argv: Array<string>
    env: {[key: string]: string | undefined}
    pid: number
    platform: 'aix' | 'android' | 'darwin' | 'freebsd' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin'
    type: string | undefined
  }
  punycode: any
}

declare namespace NodeJS {
  interface Global {
    DEBUGActionLoop: () => void
    DEBUGEffectById: any
    DEBUGEngine: any
    DEBUGLoaded: boolean
    DEBUGLogSagas: any
    DEBUGLogSagasWithNames: any
    DEBUGNavigator: any
    DEBUGRootEffects: any
    DEBUGSagaMiddleware: any
    DEBUGStore: any
    globalLogger: any
    KB: typeof KB
  }
}
