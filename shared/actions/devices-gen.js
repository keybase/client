// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/devices'
import * as Constants from '../constants/devices'

// Constants
export const resetStore = 'common:resetStore' // not a part of devices but is handled by every reducer
export const devicesLoad = 'devices:devicesLoad'
export const devicesLoaded = 'devices:devicesLoaded'
export const endangeredTLFsLoad = 'devices:endangeredTLFsLoad'
export const endangeredTLFsLoaded = 'devices:endangeredTLFsLoaded'
export const paperKeyMake = 'devices:paperKeyMake'
export const replaceEntity = 'devices:replaceEntity'
export const revoke = 'devices:revoke'
export const setWaiting = 'devices:setWaiting'
export const showRevokePage = 'devices:showRevokePage'

// Action Creators
export const createDevicesLoad = () => ({error: false, payload: undefined, type: devicesLoad})
export const createDevicesLoaded = (payload: {|+idToDetail: {[id: string]: Types.DeviceDetail}|}) => ({error: false, payload, type: devicesLoaded})
export const createEndangeredTLFsLoad = (payload: {|+deviceID: string|}) => ({error: false, payload, type: endangeredTLFsLoad})
export const createEndangeredTLFsLoaded = (payload: {|+tlfs: Array<string>|}) => ({error: false, payload, type: endangeredTLFsLoaded})
export const createPaperKeyMake = () => ({error: false, payload: undefined, type: paperKeyMake})
export const createReplaceEntity = (payload: {|+keyPath: Array<string>, +entities: I.Map<any, any> | I.List<any>|}) => ({error: false, payload, type: replaceEntity})
export const createRevoke = (payload: {|+deviceID: string|}) => ({error: false, payload, type: revoke})
export const createSetWaiting = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: setWaiting})
export const createShowRevokePage = (payload: {|+deviceID: string|}) => ({error: false, payload, type: showRevokePage})

// Action Payloads
export type DevicesLoadPayload = More.ReturnType<typeof createDevicesLoad>
export type DevicesLoadedPayload = More.ReturnType<typeof createDevicesLoaded>
export type EndangeredTLFsLoadPayload = More.ReturnType<typeof createEndangeredTLFsLoad>
export type EndangeredTLFsLoadedPayload = More.ReturnType<typeof createEndangeredTLFsLoaded>
export type PaperKeyMakePayload = More.ReturnType<typeof createPaperKeyMake>
export type ReplaceEntityPayload = More.ReturnType<typeof createReplaceEntity>
export type RevokePayload = More.ReturnType<typeof createRevoke>
export type SetWaitingPayload = More.ReturnType<typeof createSetWaiting>
export type ShowRevokePagePayload = More.ReturnType<typeof createShowRevokePage>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createDevicesLoad>
  | More.ReturnType<typeof createDevicesLoaded>
  | More.ReturnType<typeof createEndangeredTLFsLoad>
  | More.ReturnType<typeof createEndangeredTLFsLoaded>
  | More.ReturnType<typeof createPaperKeyMake>
  | More.ReturnType<typeof createReplaceEntity>
  | More.ReturnType<typeof createRevoke>
  | More.ReturnType<typeof createSetWaiting>
  | More.ReturnType<typeof createShowRevokePage>
  | {type: 'common:resetStore', payload: void}
