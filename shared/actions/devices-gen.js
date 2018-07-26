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
export const endangeredTLFsLoad = 'devices:endangeredTLFsLoad'
export const endangeredTLFsLoaded = 'devices:endangeredTLFsLoaded'
export const load = 'devices:load'
export const loaded = 'devices:loaded'
export const paperKeyCreated = 'devices:paperKeyCreated'
export const paperKeyMake = 'devices:paperKeyMake'
export const showDevicePage = 'devices:showDevicePage'
export const showRevokePage = 'devices:showRevokePage'

// Payload Types
type _DeviceRevokePayload = $ReadOnly<{|deviceID: Types.DeviceID|}>
type _DeviceRevokedPayload = $ReadOnly<{|
  deviceID: Types.DeviceID,
  wasCurrentDevice: boolean,
  deviceName: string,
|}>
type _EndangeredTLFsLoadPayload = $ReadOnly<{|deviceID: Types.DeviceID|}>
type _EndangeredTLFsLoadedPayload = $ReadOnly<{|
  deviceID: Types.DeviceID,
  tlfs: Array<string>,
|}>
type _LoadPayload = void
type _LoadedPayload = $ReadOnly<{|devices: Array<Types.Device>|}>
type _PaperKeyCreatedPayload = $ReadOnly<{|paperKey: HiddenString|}>
type _PaperKeyMakePayload = void
type _ShowDevicePagePayload = $ReadOnly<{|deviceID: Types.DeviceID|}>
type _ShowRevokePagePayload = $ReadOnly<{|deviceID: Types.DeviceID|}>

// Action Creators
export const createDeviceRevoke = (payload: _DeviceRevokePayload) => ({error: false, payload, type: deviceRevoke})
export const createDeviceRevoked = (payload: _DeviceRevokedPayload) => ({error: false, payload, type: deviceRevoked})
export const createEndangeredTLFsLoad = (payload: _EndangeredTLFsLoadPayload) => ({error: false, payload, type: endangeredTLFsLoad})
export const createEndangeredTLFsLoaded = (payload: _EndangeredTLFsLoadedPayload) => ({error: false, payload, type: endangeredTLFsLoaded})
export const createLoad = (payload: _LoadPayload) => ({error: false, payload, type: load})
export const createLoaded = (payload: _LoadedPayload) => ({error: false, payload, type: loaded})
export const createPaperKeyCreated = (payload: _PaperKeyCreatedPayload) => ({error: false, payload, type: paperKeyCreated})
export const createPaperKeyMake = (payload: _PaperKeyMakePayload) => ({error: false, payload, type: paperKeyMake})
export const createShowDevicePage = (payload: _ShowDevicePagePayload) => ({error: false, payload, type: showDevicePage})
export const createShowRevokePage = (payload: _ShowRevokePagePayload) => ({error: false, payload, type: showRevokePage})

// Action Payloads
export type DeviceRevokePayload = $Call<typeof createDeviceRevoke, _DeviceRevokePayload>
export type DeviceRevokedPayload = $Call<typeof createDeviceRevoked, _DeviceRevokedPayload>
export type EndangeredTLFsLoadPayload = $Call<typeof createEndangeredTLFsLoad, _EndangeredTLFsLoadPayload>
export type EndangeredTLFsLoadedPayload = $Call<typeof createEndangeredTLFsLoaded, _EndangeredTLFsLoadedPayload>
export type LoadPayload = $Call<typeof createLoad, _LoadPayload>
export type LoadedPayload = $Call<typeof createLoaded, _LoadedPayload>
export type PaperKeyCreatedPayload = $Call<typeof createPaperKeyCreated, _PaperKeyCreatedPayload>
export type PaperKeyMakePayload = $Call<typeof createPaperKeyMake, _PaperKeyMakePayload>
export type ShowDevicePagePayload = $Call<typeof createShowDevicePage, _ShowDevicePagePayload>
export type ShowRevokePagePayload = $Call<typeof createShowRevokePage, _ShowRevokePagePayload>

// All Actions
// prettier-ignore
export type Actions =
  | DeviceRevokePayload
  | DeviceRevokedPayload
  | EndangeredTLFsLoadPayload
  | EndangeredTLFsLoadedPayload
  | LoadPayload
  | LoadedPayload
  | PaperKeyCreatedPayload
  | PaperKeyMakePayload
  | ShowDevicePagePayload
  | ShowRevokePagePayload
  | {type: 'common:resetStore', payload: void}
