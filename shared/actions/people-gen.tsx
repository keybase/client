// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as Types from '../constants/types/people'

// Constants
export const resetStore = 'common:resetStore' // not a part of people but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'people:'
export const badgeAppForWotNotifications = 'people:badgeAppForWotNotifications'
export const dismissAnnouncement = 'people:dismissAnnouncement'
export const dismissWotNotifications = 'people:dismissWotNotifications'
export const markViewed = 'people:markViewed'
export const skipTodo = 'people:skipTodo'

// Action Creators
export const createBadgeAppForWotNotifications = (payload: {
  readonly updates: Map<string, Types.WotUpdate>
}) => ({payload, type: badgeAppForWotNotifications as typeof badgeAppForWotNotifications})
export const createDismissAnnouncement = (payload: {readonly id: RPCTypes.HomeScreenAnnouncementID}) => ({
  payload,
  type: dismissAnnouncement as typeof dismissAnnouncement,
})
export const createDismissWotNotifications = (payload: {
  readonly voucher: string
  readonly vouchee: string
}) => ({payload, type: dismissWotNotifications as typeof dismissWotNotifications})
export const createMarkViewed = (payload?: undefined) => ({payload, type: markViewed as typeof markViewed})
export const createSkipTodo = (payload: {readonly type: Types.TodoType}) => ({
  payload,
  type: skipTodo as typeof skipTodo,
})

// Action Payloads
export type BadgeAppForWotNotificationsPayload = ReturnType<typeof createBadgeAppForWotNotifications>
export type DismissAnnouncementPayload = ReturnType<typeof createDismissAnnouncement>
export type DismissWotNotificationsPayload = ReturnType<typeof createDismissWotNotifications>
export type MarkViewedPayload = ReturnType<typeof createMarkViewed>
export type SkipTodoPayload = ReturnType<typeof createSkipTodo>

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppForWotNotificationsPayload
  | DismissAnnouncementPayload
  | DismissWotNotificationsPayload
  | MarkViewedPayload
  | SkipTodoPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
