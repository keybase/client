declare var __DEV__: boolean
declare var __STORYBOOK__: boolean
declare var __STORYSHOT__: boolean
type Omit<T, K> = Pick<T, Exclude<keyof T, K>>

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
}
