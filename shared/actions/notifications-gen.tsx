// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of notifications but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'notifications:'
export const listenForKBFSNotifications = 'notifications:listenForKBFSNotifications'
export const listenForNotifications = 'notifications:listenForNotifications'
export const receivedBadgeState = 'notifications:receivedBadgeState'

// Action Creators
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

// Action Payloads
export type ListenForKBFSNotificationsPayload = ReturnType<typeof createListenForKBFSNotifications>
export type ListenForNotificationsPayload = ReturnType<typeof createListenForNotifications>
export type ReceivedBadgeStatePayload = ReturnType<typeof createReceivedBadgeState>

// All Actions
// prettier-ignore
export type Actions =
  | ListenForKBFSNotificationsPayload
  | ListenForNotificationsPayload
  | ReceivedBadgeStatePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
