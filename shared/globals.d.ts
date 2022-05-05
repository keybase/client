declare var __HOT__: boolean
declare var __REMOTEDEV__: boolean
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

declare type KBElectronOpenDialogOptions = {
  allowFiles?: boolean
  allowDirectories?: boolean
  allowMultiselect?: boolean
  buttonLabel?: string
  defaultPath?: string
  filters?: Array<{extensions: Array<string>; name: string}>
  message?: string
  title?: string
}

declare type KBElectronSaveDialogOptions = {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  message?: string
}

interface Window {
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

// TODO deprecate
declare var KB: {
  electron: {
    app: {
      appPath: string
    }
    dialog: {
      showOpenDialog: (options: KBElectronOpenDialogOptions) => Promise<Array<string> | undefined>
      showSaveDialog: (options: KBElectronSaveDialogOptions) => Promise<string | undefined>
    }
  }
  kb: {
    darwinCopyToKBFSTempUploadFile: (p: string) => Promise<string>
    darwinCopyToChatTempUploadFile: (p: string) => Promise<{
      outboxID: Buffer
      path: string
    }>
    setEngine: (e: any) => void
  }
  path: {
    basename: (p: string, ext?: string) => string
    dirname: (p: string) => string
    extname: (p: string) => string
    join: (...paths: Array<string>) => string
    resolve: (...pathSegments: Array<string>) => string
    sep: '\\' | '/'
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
