// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type HiddenString from '../util/hidden-string'
import type {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of login but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'login:'
export const loadIsOnline = 'login:loadIsOnline'
export const loadedIsOnline = 'login:loadedIsOnline'
export const login = 'login:login'
export const loginError = 'login:loginError'

// Action Creators
export const createLoadIsOnline = (payload?: undefined) => ({
  payload,
  type: loadIsOnline as typeof loadIsOnline,
})
export const createLoadedIsOnline = (payload: {readonly isOnline: boolean}) => ({
  payload,
  type: loadedIsOnline as typeof loadedIsOnline,
})
export const createLogin = (payload: {readonly username: string; readonly password: HiddenString}) => ({
  payload,
  type: login as typeof login,
})
export const createLoginError = (payload: {readonly error?: RPCError} = {}) => ({
  payload,
  type: loginError as typeof loginError,
})

// Action Payloads
export type LoadIsOnlinePayload = ReturnType<typeof createLoadIsOnline>
export type LoadedIsOnlinePayload = ReturnType<typeof createLoadedIsOnline>
export type LoginErrorPayload = ReturnType<typeof createLoginError>
export type LoginPayload = ReturnType<typeof createLogin>

// All Actions
// prettier-ignore
export type Actions =
  | LoadIsOnlinePayload
  | LoadedIsOnlinePayload
  | LoginErrorPayload
  | LoginPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
