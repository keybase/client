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
  electron: {
    app: {
      getAppPath: () => string
    }
    shell: {
      openExternal: (url: string) => Promise<void>
    }
    systemPreferences: {
      isDarkMode: () => boolean
    }
  }
  fs: {
    isDirectory: (path: string) => boolean
    readServerConfig: () => Object
    readJsonDebug: () => Object
  }
  os: {
    homedir: () => string
  }
  path: {
    basename: (p: string, ext?: string | undefined) => string
    dirname: (p: string) => string
    isAbsolute: (p: string) => boolean
    join: (...pathSegments: Array<string>) => string
    resolve: (...pathSegments: Array<string>) => string
    sep: string
  }
  process: {
    env: {[key: string]: string | undefined}
    platform: 'aix' | 'android' | 'darwin' | 'freebsd' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin'
  }
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
