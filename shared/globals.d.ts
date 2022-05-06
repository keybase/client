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
  kb: {
    // darwinCopyToKBFSTempUploadFile: (p: string) => Promise<string>
    darwinCopyToChatTempUploadFile: (p: string) => Promise<{
      outboxID: Buffer
      path: string
    }>
    // not needed if the above move over
    setEngine: (e: any) => void
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
