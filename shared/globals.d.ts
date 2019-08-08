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
}

interface Console {
  _log: any
  _warn: any
  _error: any
  _info: any
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
  }
}
