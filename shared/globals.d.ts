/// <reference types="jest" />

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
  var KBINBOX: unknown
  var DEBUGLog: (s: unknown) => void
  var DEBUGWarn: (s: unknown) => void
  var DEBUGInfo: (s: unknown) => void
  var DEBUGError: (s: unknown) => void
  var _fromPreload: unknown
  var __HOT__: boolean
  var __DEV__: boolean
  var __VERSION__: string
  var __FILE_SUFFIX__: string
  var __PROFILE__: boolean
  var rpcOnGo: undefined | ((msg: unknown) => void)
  var rpcOnJs: undefined | ((objs: unknown, count: number) => void)
  var kbJSIExperimentConfig:
    | undefined
    | {
        inboundBinaryMode: number
        inboundBinaryModeName: string
        outboundTypedArrayFastPath: boolean
        perf: boolean
      }
  var kbJSIPerf:
    | undefined
    | {
        makeBinary: (
          size?: number,
          mode?: 'uint8Array' | 'arrayBuffer' | 'wrappedUint8Array'
        ) => unknown
        reset: () => boolean
        roundTrip: (
          value: unknown,
          iterations?: number,
          mode?: 'uint8Array' | 'arrayBuffer' | 'wrappedUint8Array'
        ) => {
          bytes: number
          decodeNs: number
          encodeNs: number
          iterations: number
          mode: string
          value: unknown
        }
        stats: () => Record<string, number | string>
      }
  // RN
  var __turboModuleProxy: unknown
}
