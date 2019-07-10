// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/notifications'
import * as Tabs from '../constants/tabs'

// Constants
export const resetStore = 'common:resetStore' // not a part of notifications but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'notifications:'
export const badgeApp = 'notifications:badgeApp'
export const listenForKBFSNotifications = 'notifications:listenForKBFSNotifications'
export const listenForNotifications = 'notifications:listenForNotifications'
export const receivedBadgeState = 'notifications:receivedBadgeState'
export const setBadgeCounts = 'notifications:setBadgeCounts'

// Payload Types
type _BadgeAppPayload = {readonly key: Types.NotificationKeys; readonly on: boolean; readonly count?: number}
type _ListenForKBFSNotificationsPayload = void
type _ListenForNotificationsPayload = void
type _ReceivedBadgeStatePayload = {readonly badgeState: RPCTypes.BadgeState}
type _SetBadgeCountsPayload = {readonly counts: I.Map<Tabs.Tab, number>}

// Action Creators
export const createBadgeApp = (payload: _BadgeAppPayload): BadgeAppPayload => ({payload, type: badgeApp})
export const createListenForKBFSNotifications = (
  payload: _ListenForKBFSNotificationsPayload
): ListenForKBFSNotificationsPayload => ({payload, type: listenForKBFSNotifications})
export const createListenForNotifications = (
  payload: _ListenForNotificationsPayload
): ListenForNotificationsPayload => ({payload, type: listenForNotifications})
export const createReceivedBadgeState = (payload: _ReceivedBadgeStatePayload): ReceivedBadgeStatePayload => ({
  payload,
  type: receivedBadgeState,
})
export const createSetBadgeCounts = (payload: _SetBadgeCountsPayload): SetBadgeCountsPayload => ({
  payload,
  type: setBadgeCounts,
})

// Action Payloads
export type BadgeAppPayload = {readonly payload: _BadgeAppPayload; readonly type: typeof badgeApp}
export type ListenForKBFSNotificationsPayload = {
  readonly payload: _ListenForKBFSNotificationsPayload
  readonly type: typeof listenForKBFSNotifications
}
export type ListenForNotificationsPayload = {
  readonly payload: _ListenForNotificationsPayload
  readonly type: typeof listenForNotifications
}
export type ReceivedBadgeStatePayload = {
  readonly payload: _ReceivedBadgeStatePayload
  readonly type: typeof receivedBadgeState
}
export type SetBadgeCountsPayload = {
  readonly payload: _SetBadgeCountsPayload
  readonly type: typeof setBadgeCounts
}

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppPayload
  | ListenForKBFSNotificationsPayload
  | ListenForNotificationsPayload
  | ReceivedBadgeStatePayload
  | SetBadgeCountsPayload
  | {type: 'common:resetStore', payload: {}}
