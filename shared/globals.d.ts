/* eslint-disable no-var,vars-on-top */
export {}

export type RequestIdleCallbackHandle = unknown
export type RequestIdleCallbackOptions = {
  timeout: number
}
export type RequestIdleCallbackDeadline = {
  readonly didTimeout: boolean
  timeRemaining: () => number
}

export interface Console {
  _log: unknown
  _warn: unknown
  _error: unknown
  _info: unknown
}

declare global {
  var DEBUGNavigator: unknown
  var DEBUGRouter2: unknown
  var DEBUGmadeEngine: boolean | undefined
  var DEBUGStore: unknown
  var DEBUGEngine: unknown
  var DEBUGLoaded: boolean | undefined
  var KBCONSTANTS: unknown
  var DEBUGLog: (s: unknown) => void
  var DEBUGWarn: (s: unknown) => void
  var DEBUGInfo: (s: unknown) => void
  var DEBUGError: (s: unknown) => void
  var _fromPreload: unknown
  var __HOT__: boolean
  var __VERSION__: string
  var __FILE_SUFFIX__: string
  var __PROFILE__: boolean
  var rpcOnGo: undefined | ((b: unknown) => void)
  var rpcOnJs: undefined | ((b: unknown) => void)
  // RN
  var __turboModuleProxy: unknown
}
