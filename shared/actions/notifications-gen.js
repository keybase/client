// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/notifications'

// Constants
export const resetStore = 'common:resetStore' // not a part of notifications but is handled by every reducer
export const badgeApp = 'notifications:badgeApp'
export const listenForKBFSNotifications = 'notifications:listenForKBFSNotifications'
export const listenForNotifications = 'notifications:listenForNotifications'
export const receivedBadgeState = 'notifications:receivedBadgeState'

// Payload Types
type _BadgeAppPayload = $ReadOnly<{|
  key: Types.NotificationKeys,
  on: boolean,
  count?: number,
|}>
type _ListenForKBFSNotificationsPayload = void
type _ListenForNotificationsPayload = void
type _ReceivedBadgeStatePayload = $ReadOnly<{|badgeState: RPCTypes.BadgeState|}>

// Action Creators
export const createBadgeApp = (payload: _BadgeAppPayload) => ({error: false, payload, type: badgeApp})
export const createListenForKBFSNotifications = (payload: _ListenForKBFSNotificationsPayload) => ({error: false, payload, type: listenForKBFSNotifications})
export const createListenForNotifications = (payload: _ListenForNotificationsPayload) => ({error: false, payload, type: listenForNotifications})
export const createReceivedBadgeState = (payload: _ReceivedBadgeStatePayload) => ({error: false, payload, type: receivedBadgeState})

// Action Payloads
export type BadgeAppPayload = $Call<typeof createBadgeApp, _BadgeAppPayload>
export type ListenForKBFSNotificationsPayload = $Call<typeof createListenForKBFSNotifications, _ListenForKBFSNotificationsPayload>
export type ListenForNotificationsPayload = $Call<typeof createListenForNotifications, _ListenForNotificationsPayload>
export type ReceivedBadgeStatePayload = $Call<typeof createReceivedBadgeState, _ReceivedBadgeStatePayload>

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppPayload
  | ListenForKBFSNotificationsPayload
  | ListenForNotificationsPayload
  | ReceivedBadgeStatePayload
  | {type: 'common:resetStore', payload: void}
