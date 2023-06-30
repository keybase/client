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
  var DEBUGStore: any | undefined
  var DEBUGlistenersInited: boolean | undefined
  var _fromPreload: any | undefined
  var __HOT__: boolean
  var __VERSION__: string
  var __FILE_SUFFIX__: string
  var __PROFILE__: boolean
  var __STORYBOOK__: boolean
  var __STORYSHOT__: boolean
}
