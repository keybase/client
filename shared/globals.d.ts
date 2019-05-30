declare var __VERSION__: string
declare var __DEV__: boolean
declare var __STORYBOOK__: boolean
declare var __STORYSHOT__: boolean

type RequestIdleCallbackHandle = any
type RequestIdleCallbackOptions = {
  timeout: number
}
type RequestIdleCallbackDeadline = {
  readonly didTimeout: boolean
  timeRemaining: (() => number)
}

interface Window {
  requestIdleCallback: ((
    callback: ((deadline: RequestIdleCallbackDeadline) => void),
    opts?: RequestIdleCallbackOptions
  ) => RequestIdleCallbackHandle)
  cancelIdleCallback: ((handle: RequestIdleCallbackHandle) => void)
  DEBUGEffectById: any
  DEBUGLogSagas: any
  DEBUGLogSagasWithNames: any
  DEBUGRootEffects: any
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
