// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/devices'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of devices but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'devices:'
export const badgeAppForDevices = 'devices:badgeAppForDevices'
export const clearBadges = 'devices:clearBadges'
export const endangeredTLFsLoaded = 'devices:endangeredTLFsLoaded'
export const load = 'devices:load'
export const loaded = 'devices:loaded'
export const paperKeyCreated = 'devices:paperKeyCreated'
export const revoke = 'devices:revoke'
export const revoked = 'devices:revoked'
export const showDevicePage = 'devices:showDevicePage'
export const showPaperKeyPage = 'devices:showPaperKeyPage'
export const showRevokePage = 'devices:showRevokePage'

// Payload Types
type _BadgeAppForDevicesPayload = {readonly ids: Array<string>}
type _ClearBadgesPayload = void
type _EndangeredTLFsLoadedPayload = {readonly deviceID: Types.DeviceID; readonly tlfs: Array<string>}
type _LoadPayload = void
type _LoadedPayload = {readonly devices: Array<Types.Device>}
type _PaperKeyCreatedPayload = {readonly paperKey: HiddenString}
type _RevokePayload = {readonly deviceID: Types.DeviceID}
type _RevokedPayload = {
  readonly deviceID: Types.DeviceID
  readonly wasCurrentDevice: boolean
  readonly deviceName: string
}
type _ShowDevicePagePayload = {readonly deviceID: Types.DeviceID}
type _ShowPaperKeyPagePayload = void
type _ShowRevokePagePayload = {readonly deviceID: Types.DeviceID}

// Action Creators
export const createBadgeAppForDevices = (payload: _BadgeAppForDevicesPayload): BadgeAppForDevicesPayload => ({
  payload,
  type: badgeAppForDevices,
})
export const createClearBadges = (payload: _ClearBadgesPayload): ClearBadgesPayload => ({
  payload,
  type: clearBadges,
})
export const createEndangeredTLFsLoaded = (
  payload: _EndangeredTLFsLoadedPayload
): EndangeredTLFsLoadedPayload => ({payload, type: endangeredTLFsLoaded})
export const createLoad = (payload: _LoadPayload): LoadPayload => ({payload, type: load})
export const createLoaded = (payload: _LoadedPayload): LoadedPayload => ({payload, type: loaded})
export const createPaperKeyCreated = (payload: _PaperKeyCreatedPayload): PaperKeyCreatedPayload => ({
  payload,
  type: paperKeyCreated,
})
export const createRevoke = (payload: _RevokePayload): RevokePayload => ({payload, type: revoke})
export const createRevoked = (payload: _RevokedPayload): RevokedPayload => ({payload, type: revoked})
export const createShowDevicePage = (payload: _ShowDevicePagePayload): ShowDevicePagePayload => ({
  payload,
  type: showDevicePage,
})
export const createShowPaperKeyPage = (payload: _ShowPaperKeyPagePayload): ShowPaperKeyPagePayload => ({
  payload,
  type: showPaperKeyPage,
})
export const createShowRevokePage = (payload: _ShowRevokePagePayload): ShowRevokePagePayload => ({
  payload,
  type: showRevokePage,
})

// Action Payloads
export type BadgeAppForDevicesPayload = {
  readonly payload: _BadgeAppForDevicesPayload
  readonly type: typeof badgeAppForDevices
}
export type ClearBadgesPayload = {readonly payload: _ClearBadgesPayload; readonly type: typeof clearBadges}
export type EndangeredTLFsLoadedPayload = {
  readonly payload: _EndangeredTLFsLoadedPayload
  readonly type: typeof endangeredTLFsLoaded
}
export type LoadPayload = {readonly payload: _LoadPayload; readonly type: typeof load}
export type LoadedPayload = {readonly payload: _LoadedPayload; readonly type: typeof loaded}
export type PaperKeyCreatedPayload = {
  readonly payload: _PaperKeyCreatedPayload
  readonly type: typeof paperKeyCreated
}
export type RevokePayload = {readonly payload: _RevokePayload; readonly type: typeof revoke}
export type RevokedPayload = {readonly payload: _RevokedPayload; readonly type: typeof revoked}
export type ShowDevicePagePayload = {
  readonly payload: _ShowDevicePagePayload
  readonly type: typeof showDevicePage
}
export type ShowPaperKeyPagePayload = {
  readonly payload: _ShowPaperKeyPagePayload
  readonly type: typeof showPaperKeyPage
}
export type ShowRevokePagePayload = {
  readonly payload: _ShowRevokePagePayload
  readonly type: typeof showRevokePage
}

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppForDevicesPayload
  | ClearBadgesPayload
  | EndangeredTLFsLoadedPayload
  | LoadPayload
  | LoadedPayload
  | PaperKeyCreatedPayload
  | RevokePayload
  | RevokedPayload
  | ShowDevicePagePayload
  | ShowPaperKeyPagePayload
  | ShowRevokePagePayload
  | {type: 'common:resetStore', payload: {}}
