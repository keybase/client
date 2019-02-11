// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
type _BadgeAppPayload = $ReadOnly<{|key: Types.NotificationKeys, on: boolean, count?: number|}>
type _ListenForKBFSNotificationsPayload = void
type _ListenForNotificationsPayload = void
type _ReceivedBadgeStatePayload = $ReadOnly<{|badgeState: RPCTypes.BadgeState|}>
type _SetBadgeCountsPayload = $ReadOnly<{|counts: I.Map<Tabs.Tab, number>|}>

// Action Creators
export const createBadgeApp = (payload: _BadgeAppPayload) => ({payload, type: badgeApp})
export const createListenForKBFSNotifications = (payload: _ListenForKBFSNotificationsPayload) => ({payload, type: listenForKBFSNotifications})
export const createListenForNotifications = (payload: _ListenForNotificationsPayload) => ({payload, type: listenForNotifications})
export const createReceivedBadgeState = (payload: _ReceivedBadgeStatePayload) => ({payload, type: receivedBadgeState})
export const createSetBadgeCounts = (payload: _SetBadgeCountsPayload) => ({payload, type: setBadgeCounts})

// Action Payloads
export type BadgeAppPayload = {|+payload: _BadgeAppPayload, +type: 'notifications:badgeApp'|}
export type ListenForKBFSNotificationsPayload = {|+payload: _ListenForKBFSNotificationsPayload, +type: 'notifications:listenForKBFSNotifications'|}
export type ListenForNotificationsPayload = {|+payload: _ListenForNotificationsPayload, +type: 'notifications:listenForNotifications'|}
export type ReceivedBadgeStatePayload = {|+payload: _ReceivedBadgeStatePayload, +type: 'notifications:receivedBadgeState'|}
export type SetBadgeCountsPayload = {|+payload: _SetBadgeCountsPayload, +type: 'notifications:setBadgeCounts'|}

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppPayload
  | ListenForKBFSNotificationsPayload
  | ListenForNotificationsPayload
  | ReceivedBadgeStatePayload
  | SetBadgeCountsPayload
  | {type: 'common:resetStore', payload: null}
