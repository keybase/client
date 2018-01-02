// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
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

// Action Creators
export const createDeviceRevoke = (payload: {|+deviceID: Types.DeviceID|}) => ({error: false, payload, type: deviceRevoke})
export const createDeviceRevoked = (payload: {|+deviceID: Types.DeviceID, +wasCurrentDevice: boolean, +deviceName: string|}) => ({error: false, payload, type: deviceRevoked})
export const createDevicesLoad = () => ({error: false, payload: undefined, type: devicesLoad})
export const createDevicesLoaded = (payload: {|+idToDetail: I.Map<Types.DeviceID, Types.DeviceDetail>|}) => ({error: false, payload, type: devicesLoaded})
export const createDevicesLoadedError = () => ({error: true, payload: undefined, type: devicesLoaded})
export const createEndangeredTLFsLoad = (payload: {|+deviceID: Types.DeviceID|}) => ({error: false, payload, type: endangeredTLFsLoad})
export const createEndangeredTLFsLoaded = (payload: {|+deviceID: Types.DeviceID, +tlfs: Array<string>|}) => ({error: false, payload, type: endangeredTLFsLoaded})
export const createPaperKeyCreated = (payload: {|+paperKey: HiddenString|}) => ({error: false, payload, type: paperKeyCreated})
export const createPaperKeyMake = () => ({error: false, payload: undefined, type: paperKeyMake})
export const createShowRevokePage = (payload: {|+deviceID: Types.DeviceID|}) => ({error: false, payload, type: showRevokePage})

// Action Payloads
export type DeviceRevokePayload = More.ReturnType<typeof createDeviceRevoke>
export type DeviceRevokedPayload = More.ReturnType<typeof createDeviceRevoked>
export type DevicesLoadPayload = More.ReturnType<typeof createDevicesLoad>
export type DevicesLoadedPayload = More.ReturnType<typeof createDevicesLoaded>
export type EndangeredTLFsLoadPayload = More.ReturnType<typeof createEndangeredTLFsLoad>
export type EndangeredTLFsLoadedPayload = More.ReturnType<typeof createEndangeredTLFsLoaded>
export type PaperKeyCreatedPayload = More.ReturnType<typeof createPaperKeyCreated>
export type PaperKeyMakePayload = More.ReturnType<typeof createPaperKeyMake>
export type ShowRevokePagePayload = More.ReturnType<typeof createShowRevokePage>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDeviceRevoke>
  | More.ReturnType<typeof createDeviceRevoked>
  | More.ReturnType<typeof createDevicesLoad>
  | More.ReturnType<typeof createDevicesLoaded>
  | More.ReturnType<typeof createDevicesLoadedError>
  | More.ReturnType<typeof createEndangeredTLFsLoad>
  | More.ReturnType<typeof createEndangeredTLFsLoaded>
  | More.ReturnType<typeof createPaperKeyCreated>
  | More.ReturnType<typeof createPaperKeyMake>
  | More.ReturnType<typeof createShowRevokePage>
  | {type: 'common:resetStore', payload: void}
