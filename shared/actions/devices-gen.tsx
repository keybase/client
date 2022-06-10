// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/devices'
import type HiddenString from '../util/hidden-string'

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

// Action Creators
export const createBadgeAppForDevices = (payload: {readonly ids: Array<string>}) => ({
  payload,
  type: badgeAppForDevices as typeof badgeAppForDevices,
})
export const createClearBadges = (payload?: undefined) => ({payload, type: clearBadges as typeof clearBadges})
export const createEndangeredTLFsLoaded = (payload: {
  readonly deviceID: Types.DeviceID
  readonly tlfs: Array<string>
}) => ({payload, type: endangeredTLFsLoaded as typeof endangeredTLFsLoaded})
export const createLoad = (payload?: undefined) => ({payload, type: load as typeof load})
export const createLoaded = (payload: {readonly devices: Array<Types.Device>}) => ({
  payload,
  type: loaded as typeof loaded,
})
export const createPaperKeyCreated = (payload: {readonly paperKey: HiddenString}) => ({
  payload,
  type: paperKeyCreated as typeof paperKeyCreated,
})
export const createRevoke = (payload: {readonly deviceID: Types.DeviceID}) => ({
  payload,
  type: revoke as typeof revoke,
})
export const createRevoked = (payload: {
  readonly deviceID: Types.DeviceID
  readonly wasCurrentDevice: boolean
  readonly deviceName: string
}) => ({payload, type: revoked as typeof revoked})
export const createShowDevicePage = (payload: {readonly deviceID: Types.DeviceID}) => ({
  payload,
  type: showDevicePage as typeof showDevicePage,
})
export const createShowPaperKeyPage = (payload?: undefined) => ({
  payload,
  type: showPaperKeyPage as typeof showPaperKeyPage,
})
export const createShowRevokePage = (payload: {readonly deviceID: Types.DeviceID}) => ({
  payload,
  type: showRevokePage as typeof showRevokePage,
})

// Action Payloads
export type BadgeAppForDevicesPayload = ReturnType<typeof createBadgeAppForDevices>
export type ClearBadgesPayload = ReturnType<typeof createClearBadges>
export type EndangeredTLFsLoadedPayload = ReturnType<typeof createEndangeredTLFsLoaded>
export type LoadPayload = ReturnType<typeof createLoad>
export type LoadedPayload = ReturnType<typeof createLoaded>
export type PaperKeyCreatedPayload = ReturnType<typeof createPaperKeyCreated>
export type RevokePayload = ReturnType<typeof createRevoke>
export type RevokedPayload = ReturnType<typeof createRevoked>
export type ShowDevicePagePayload = ReturnType<typeof createShowDevicePage>
export type ShowPaperKeyPagePayload = ReturnType<typeof createShowPaperKeyPage>
export type ShowRevokePagePayload = ReturnType<typeof createShowRevokePage>

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
  | {readonly type: 'common:resetStore', readonly payload: undefined}
