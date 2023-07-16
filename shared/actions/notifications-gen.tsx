// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of notifications but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'notifications:'
export const listenForKBFSNotifications = 'notifications:listenForKBFSNotifications'
export const listenForNotifications = 'notifications:listenForNotifications'

// Action Creators
export const createListenForKBFSNotifications = (payload?: undefined) => ({
  payload,
  type: listenForKBFSNotifications as typeof listenForKBFSNotifications,
})
export const createListenForNotifications = (payload?: undefined) => ({
  payload,
  type: listenForNotifications as typeof listenForNotifications,
})

// Action Payloads
export type ListenForKBFSNotificationsPayload = ReturnType<typeof createListenForKBFSNotifications>
export type ListenForNotificationsPayload = ReturnType<typeof createListenForNotifications>

// All Actions
// prettier-ignore
export type Actions =
  | ListenForKBFSNotificationsPayload
  | ListenForNotificationsPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
