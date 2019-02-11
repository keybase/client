// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/devices'
import * as Constants from '../constants/devices'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of devices but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'devices:'
export const badgeAppForDevices = 'devices:badgeAppForDevices'
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
type _BadgeAppForDevicesPayload = $ReadOnly<{|ids: Array<string>|}>
type _EndangeredTLFsLoadedPayload = $ReadOnly<{|deviceID: Types.DeviceID, tlfs: Array<string>|}>
type _LoadPayload = void
type _LoadedPayload = $ReadOnly<{|devices: Array<Types.Device>|}>
type _PaperKeyCreatedPayload = $ReadOnly<{|paperKey: HiddenString|}>
type _RevokePayload = $ReadOnly<{|deviceID: Types.DeviceID|}>
type _RevokedPayload = $ReadOnly<{|deviceID: Types.DeviceID, wasCurrentDevice: boolean, deviceName: string|}>
type _ShowDevicePagePayload = $ReadOnly<{|deviceID: Types.DeviceID|}>
type _ShowPaperKeyPagePayload = void
type _ShowRevokePagePayload = $ReadOnly<{|deviceID: Types.DeviceID|}>

// Action Creators
export const createBadgeAppForDevices = (payload: _BadgeAppForDevicesPayload) => ({payload, type: badgeAppForDevices})
export const createEndangeredTLFsLoaded = (payload: _EndangeredTLFsLoadedPayload) => ({payload, type: endangeredTLFsLoaded})
export const createLoad = (payload: _LoadPayload) => ({payload, type: load})
export const createLoaded = (payload: _LoadedPayload) => ({payload, type: loaded})
export const createPaperKeyCreated = (payload: _PaperKeyCreatedPayload) => ({payload, type: paperKeyCreated})
export const createRevoke = (payload: _RevokePayload) => ({payload, type: revoke})
export const createRevoked = (payload: _RevokedPayload) => ({payload, type: revoked})
export const createShowDevicePage = (payload: _ShowDevicePagePayload) => ({payload, type: showDevicePage})
export const createShowPaperKeyPage = (payload: _ShowPaperKeyPagePayload) => ({payload, type: showPaperKeyPage})
export const createShowRevokePage = (payload: _ShowRevokePagePayload) => ({payload, type: showRevokePage})

// Action Payloads
export type BadgeAppForDevicesPayload = {|+payload: _BadgeAppForDevicesPayload, +type: 'devices:badgeAppForDevices'|}
export type EndangeredTLFsLoadedPayload = {|+payload: _EndangeredTLFsLoadedPayload, +type: 'devices:endangeredTLFsLoaded'|}
export type LoadPayload = {|+payload: _LoadPayload, +type: 'devices:load'|}
export type LoadedPayload = {|+payload: _LoadedPayload, +type: 'devices:loaded'|}
export type PaperKeyCreatedPayload = {|+payload: _PaperKeyCreatedPayload, +type: 'devices:paperKeyCreated'|}
export type RevokePayload = {|+payload: _RevokePayload, +type: 'devices:revoke'|}
export type RevokedPayload = {|+payload: _RevokedPayload, +type: 'devices:revoked'|}
export type ShowDevicePagePayload = {|+payload: _ShowDevicePagePayload, +type: 'devices:showDevicePage'|}
export type ShowPaperKeyPagePayload = {|+payload: _ShowPaperKeyPagePayload, +type: 'devices:showPaperKeyPage'|}
export type ShowRevokePagePayload = {|+payload: _ShowRevokePagePayload, +type: 'devices:showRevokePage'|}

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppForDevicesPayload
  | EndangeredTLFsLoadedPayload
  | LoadPayload
  | LoadedPayload
  | PaperKeyCreatedPayload
  | RevokePayload
  | RevokedPayload
  | ShowDevicePagePayload
  | ShowPaperKeyPagePayload
  | ShowRevokePagePayload
  | {type: 'common:resetStore', payload: null}
