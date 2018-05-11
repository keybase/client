// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/devices'
import * as Constants from '../constants/devices'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of devices but is handled by every reducer
export const deviceRevoke = 'devices:deviceRevoke'
export const deviceRevoked = 'devices:deviceRevoked'
export const devicesLoad = 'devices:devicesLoad'
export const devicesLoaded = 'devices:devicesLoaded'
export const endangeredTLFsLoad = 'devices:endangeredTLFsLoad'
export const endangeredTLFsLoaded = 'devices:endangeredTLFsLoaded'
export const paperKeyCreated = 'devices:paperKeyCreated'
export const paperKeyMake = 'devices:paperKeyMake'
export const showRevokePage = 'devices:showRevokePage'

// Payload Types
type _DeviceRevokePayload = $ReadOnly<{|deviceID: Types.DeviceID|}>
type _DeviceRevokedPayload = $ReadOnly<{|
  deviceID: Types.DeviceID,
  wasCurrentDevice: boolean,
  deviceName: string,
|}>
type _DevicesLoadPayload = void
type _DevicesLoadedPayload = $ReadOnly<{|idToDetail: I.Map<Types.DeviceID, Types.DeviceDetail>|}>
type _DevicesLoadedPayloadError = void
type _EndangeredTLFsLoadPayload = $ReadOnly<{|deviceID: Types.DeviceID|}>
type _EndangeredTLFsLoadedPayload = $ReadOnly<{|
  deviceID: Types.DeviceID,
  tlfs: Array<string>,
|}>
type _PaperKeyCreatedPayload = $ReadOnly<{|paperKey: HiddenString|}>
type _PaperKeyMakePayload = void
type _ShowRevokePagePayload = $ReadOnly<{|deviceID: Types.DeviceID|}>

// Action Creators
export const createDeviceRevoke = (payload: _DeviceRevokePayload) => ({error: false, payload, type: deviceRevoke})
export const createDeviceRevoked = (payload: _DeviceRevokedPayload) => ({error: false, payload, type: deviceRevoked})
export const createDevicesLoad = (payload: _DevicesLoadPayload) => ({error: false, payload, type: devicesLoad})
export const createDevicesLoaded = (payload: _DevicesLoadedPayload) => ({error: false, payload, type: devicesLoaded})
export const createDevicesLoadedError = (payload: _DevicesLoadedPayloadError) => ({error: true, payload, type: devicesLoaded})
export const createEndangeredTLFsLoad = (payload: _EndangeredTLFsLoadPayload) => ({error: false, payload, type: endangeredTLFsLoad})
export const createEndangeredTLFsLoaded = (payload: _EndangeredTLFsLoadedPayload) => ({error: false, payload, type: endangeredTLFsLoaded})
export const createPaperKeyCreated = (payload: _PaperKeyCreatedPayload) => ({error: false, payload, type: paperKeyCreated})
export const createPaperKeyMake = (payload: _PaperKeyMakePayload) => ({error: false, payload, type: paperKeyMake})
export const createShowRevokePage = (payload: _ShowRevokePagePayload) => ({error: false, payload, type: showRevokePage})

// Action Payloads
export type DeviceRevokePayload = $Call<typeof createDeviceRevoke, _DeviceRevokePayload>
export type DeviceRevokedPayload = $Call<typeof createDeviceRevoked, _DeviceRevokedPayload>
export type DevicesLoadPayload = $Call<typeof createDevicesLoad, _DevicesLoadPayload>
export type DevicesLoadedPayload = $Call<typeof createDevicesLoaded, _DevicesLoadedPayload>
export type DevicesLoadedPayloadError = $Call<typeof createDevicesLoadedError, _DevicesLoadedPayloadError>
export type EndangeredTLFsLoadPayload = $Call<typeof createEndangeredTLFsLoad, _EndangeredTLFsLoadPayload>
export type EndangeredTLFsLoadedPayload = $Call<typeof createEndangeredTLFsLoaded, _EndangeredTLFsLoadedPayload>
export type PaperKeyCreatedPayload = $Call<typeof createPaperKeyCreated, _PaperKeyCreatedPayload>
export type PaperKeyMakePayload = $Call<typeof createPaperKeyMake, _PaperKeyMakePayload>
export type ShowRevokePagePayload = $Call<typeof createShowRevokePage, _ShowRevokePagePayload>

// All Actions
// prettier-ignore
export type Actions =
  | DeviceRevokePayload
  | DeviceRevokedPayload
  | DevicesLoadPayload
  | DevicesLoadedPayload
  | DevicesLoadedPayloadError
  | EndangeredTLFsLoadPayload
  | EndangeredTLFsLoadedPayload
  | PaperKeyCreatedPayload
  | PaperKeyMakePayload
  | ShowRevokePagePayload
  | {type: 'common:resetStore', payload: void}
