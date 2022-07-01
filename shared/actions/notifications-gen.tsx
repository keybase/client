// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/notifications'
import type * as Tabs from '../constants/tabs'

// Constants
export const resetStore = 'common:resetStore' // not a part of notifications but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'notifications:'
export const badgeApp = 'notifications:badgeApp'
export const listenForKBFSNotifications = 'notifications:listenForKBFSNotifications'
export const listenForNotifications = 'notifications:listenForNotifications'
export const receivedBadgeState = 'notifications:receivedBadgeState'
export const setBadgeCounts = 'notifications:setBadgeCounts'

// Action Creators
export const createBadgeApp = (payload: {
  readonly key: Types.NotificationKeys
  readonly on: boolean
  readonly count?: number
}) => ({payload, type: badgeApp as typeof badgeApp})
export const createListenForKBFSNotifications = (payload?: undefined) => ({
  payload,
  type: listenForKBFSNotifications as typeof listenForKBFSNotifications,
})
export const createListenForNotifications = (payload?: undefined) => ({
  payload,
  type: listenForNotifications as typeof listenForNotifications,
})
export const createReceivedBadgeState = (payload: {readonly badgeState: RPCTypes.BadgeState}) => ({
  payload,
  type: receivedBadgeState as typeof receivedBadgeState,
})
export const createSetBadgeCounts = (payload: {readonly counts: Map<Tabs.Tab, number>}) => ({
  payload,
  type: setBadgeCounts as typeof setBadgeCounts,
})

// Action Payloads
export type BadgeAppPayload = ReturnType<typeof createBadgeApp>
export type ListenForKBFSNotificationsPayload = ReturnType<typeof createListenForKBFSNotifications>
export type ListenForNotificationsPayload = ReturnType<typeof createListenForNotifications>
export type ReceivedBadgeStatePayload = ReturnType<typeof createReceivedBadgeState>
export type SetBadgeCountsPayload = ReturnType<typeof createSetBadgeCounts>

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppPayload
  | ListenForKBFSNotificationsPayload
  | ListenForNotificationsPayload
  | ReceivedBadgeStatePayload
  | SetBadgeCountsPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
