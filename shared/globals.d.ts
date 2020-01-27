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
  KB: typeof KB
  process: any
}

interface Console {
  _log: any
  _warn: any
  _error: any
  _info: any
}

declare var KB: {
  DEV?: {
    DEBUGActionLoop?: any
    DEBUGEffectById?: any
    DEBUGEngine?: any
    DEBUGLoaded?: boolean
    DEBUGLogSagas?: any
    DEBUGLogSagasWithNames?: any
    DEBUGNavigator?: any
    DEBUGRootEffects?: any
    DEBUGSagaMiddleware?: any
    DEBUGStore?: any
    events?: any
    url?: any
  }
  __child_process: any
  __dirname: string
  __electron: any
  __fs: any
  __os: any
  __path: any
  __process: any
  anyToMainDispatchAction: any
  buffer: any
  framedMsgpackRpc: any
  handleAnyToMainDispatchAction: any
  handleDarkModeChanged: any
  handlePowerMonitor: any
  handleRenderToMain: any
  handleRendererToMainMenu: any
  isDarkMode: any
  mainLoggerDump: any
  platform: any
  punycode: any
  purepack: any
  renderToMain: any
  rendererToMainMenu: any
  showMessageBox: any
  showOpenDialog: any
  unhandleDarkModeChanged: any
}

declare namespace NodeJS {
  interface Global {
    KB: typeof KB
  }
}
