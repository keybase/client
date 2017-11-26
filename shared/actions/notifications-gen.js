// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/notifications'

// Constants
export const resetStore = 'common:resetStore' // not a part of notifications but is handled by every reducer
export const badgeApp = 'notifications:badgeApp'
export const listenForKBFSNotifications = 'notifications:listenForKBFSNotifications'
export const listenForNotifications = 'notifications:listenForNotifications'
export const log = 'notifications:log'
export const receivedBadgeState = 'notifications:receivedBadgeState'

// Action Creators
export const createBadgeApp = (payload: {|+key: Types.NotificationKeys, +on: boolean, +count?: number|}) => ({error: false, payload, type: badgeApp})
export const createListenForKBFSNotifications = () => ({error: false, payload: undefined, type: listenForKBFSNotifications})
export const createListenForNotifications = () => ({error: false, payload: undefined, type: listenForNotifications})
export const createLog = (payload: {|+level: RPCTypes.LogLevel, +text: string|}) => ({error: false, payload, type: log})
export const createReceivedBadgeState = (payload: {|+badgeState: RPCTypes.BadgeState|}) => ({error: false, payload, type: receivedBadgeState})

// Action Payloads
export type BadgeAppPayload = More.ReturnType<typeof createBadgeApp>
export type ListenForKBFSNotificationsPayload = More.ReturnType<typeof createListenForKBFSNotifications>
export type ListenForNotificationsPayload = More.ReturnType<typeof createListenForNotifications>
export type LogPayload = More.ReturnType<typeof createLog>
export type ReceivedBadgeStatePayload = More.ReturnType<typeof createReceivedBadgeState>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createBadgeApp>
  | More.ReturnType<typeof createListenForKBFSNotifications>
  | More.ReturnType<typeof createListenForNotifications>
  | More.ReturnType<typeof createLog>
  | More.ReturnType<typeof createReceivedBadgeState>
  | {type: 'common:resetStore', payload: void}
