// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/provision'

// Constants
export const resetStore = 'common:resetStore' // not a part of recover-password but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'recover-password:'
export const showDeviceListPage = 'recover-password:showDeviceListPage'
export const startRecoverPassword = 'recover-password:startRecoverPassword'

// Payload Types
type _ShowDeviceListPagePayload = {readonly devices: Array<Types.Device>}
type _StartRecoverPasswordPayload = {readonly username: string}

// Action Creators
export const createShowDeviceListPage = (payload: _ShowDeviceListPagePayload): ShowDeviceListPagePayload => ({
  payload,
  type: showDeviceListPage,
})
export const createStartRecoverPassword = (
  payload: _StartRecoverPasswordPayload
): StartRecoverPasswordPayload => ({payload, type: startRecoverPassword})

// Action Payloads
export type ShowDeviceListPagePayload = {
  readonly payload: _ShowDeviceListPagePayload
  readonly type: typeof showDeviceListPage
}
export type StartRecoverPasswordPayload = {
  readonly payload: _StartRecoverPasswordPayload
  readonly type: typeof startRecoverPassword
}

// All Actions
// prettier-ignore
export type Actions =
  | ShowDeviceListPagePayload
  | StartRecoverPasswordPayload
  | {type: 'common:resetStore', payload: {}}
