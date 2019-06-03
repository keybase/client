declare var __VERSION__: string
declare var __DEV__: boolean
declare var __STORYBOOK__: boolean
declare var __STORYSHOT__: boolean

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
    clearInterval(handle: number): void
    clearTimeout(handle: number): void
    setInterval(handler: (...args: any[]) => void, timeout: number): number
    setInterval(handler: any, timeout?: any, ...args: any[]): number
    setTimeout(handler: (...args: any[]) => void, timeout: number): number
    setTimeout(handler: any, timeout?: any, ...args: any[]): number
    clearImmediate(handle: number): void
    setImmediate(handler: (...args: any[]) => void): number
  }
}
