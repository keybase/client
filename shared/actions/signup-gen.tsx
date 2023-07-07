// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type HiddenString from '../util/hidden-string'
import type {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'signup:'
export const checkDevicename = 'signup:checkDevicename'
export const checkPassword = 'signup:checkPassword'
export const checkedDevicename = 'signup:checkedDevicename'
export const signedup = 'signup:signedup'

// Action Creators
export const createCheckDevicename = (payload: {readonly devicename: string}) => ({
  payload,
  type: checkDevicename as typeof checkDevicename,
})
export const createCheckPassword = (payload: {
  readonly pass1: HiddenString
  readonly pass2: HiddenString
}) => ({payload, type: checkPassword as typeof checkPassword})
export const createCheckedDevicename = (payload: {readonly devicename: string; readonly error?: string}) => ({
  payload,
  type: checkedDevicename as typeof checkedDevicename,
})
export const createSignedup = (payload: {readonly error?: RPCError} = {}) => ({
  payload,
  type: signedup as typeof signedup,
})

// Action Payloads
export type CheckDevicenamePayload = ReturnType<typeof createCheckDevicename>
export type CheckPasswordPayload = ReturnType<typeof createCheckPassword>
export type CheckedDevicenamePayload = ReturnType<typeof createCheckedDevicename>
export type SignedupPayload = ReturnType<typeof createSignedup>

// All Actions
// prettier-ignore
export type Actions =
  | CheckDevicenamePayload
  | CheckPasswordPayload
  | CheckedDevicenamePayload
  | SignedupPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
