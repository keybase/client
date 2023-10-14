/* eslint-disable no-var */
export {}

export type RequestIdleCallbackHandle = any
export type RequestIdleCallbackOptions = {
  timeout: number
}
export type RequestIdleCallbackDeadline = {
  readonly didTimeout: boolean
  timeRemaining: () => number
}

export interface Console {
  _log: any
  _warn: any
  _error: any
  _info: any
}

declare global {
  var DEBUGmadeEngine: boolean | undefined
  var DEBUGStore: unknown
  var DEBUGEngine: unknown
  var DEBUGLoaded: boolean | undefined
  var KBCONSTANTS: unknown
  var _fromPreload: any
  var __HOT__: boolean
  var __VERSION__: string
  var __FILE_SUFFIX__: string
  var __PROFILE__: boolean
  var rpcOnGo: undefined | ((b: unknown) => void)
  var rpcOnJs: undefined | ((b: unknown) => void)
}
