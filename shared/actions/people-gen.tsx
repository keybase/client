// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/people'

// Constants
export const resetStore = 'common:resetStore' // not a part of people but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'people:'
export const badgeAppForWotNotifications = 'people:badgeAppForWotNotifications'
export const dismissAnnouncement = 'people:dismissAnnouncement'
export const dismissWotNotifications = 'people:dismissWotNotifications'
export const getPeopleData = 'people:getPeopleData'
export const markViewed = 'people:markViewed'
export const peopleDataProcessed = 'people:peopleDataProcessed'
export const setResentEmail = 'people:setResentEmail'
export const skipTodo = 'people:skipTodo'

// Payload Types
type _BadgeAppForWotNotificationsPayload = {readonly updates: Map<string, Types.WotUpdate>}
type _DismissAnnouncementPayload = {readonly id: RPCTypes.HomeScreenAnnouncementID}
type _DismissWotNotificationsPayload = {readonly voucher: string; readonly vouchee: string}
type _GetPeopleDataPayload = {readonly markViewed: boolean; readonly numFollowSuggestionsWanted: number}
type _MarkViewedPayload = void
type _PeopleDataProcessedPayload = {
  readonly oldItems: Array<Types.PeopleScreenItem>
  readonly newItems: Array<Types.PeopleScreenItem>
  readonly followSuggestions: Array<Types.FollowSuggestion>
  readonly lastViewed: Date
  readonly version: number
}
type _SetResentEmailPayload = {readonly email: string}
type _SkipTodoPayload = {readonly type: Types.TodoType}

// Action Creators
export const createBadgeAppForWotNotifications = (
  payload: _BadgeAppForWotNotificationsPayload
): BadgeAppForWotNotificationsPayload => ({payload, type: badgeAppForWotNotifications})
export const createDismissAnnouncement = (
  payload: _DismissAnnouncementPayload
): DismissAnnouncementPayload => ({payload, type: dismissAnnouncement})
export const createDismissWotNotifications = (
  payload: _DismissWotNotificationsPayload
): DismissWotNotificationsPayload => ({payload, type: dismissWotNotifications})
export const createGetPeopleData = (payload: _GetPeopleDataPayload): GetPeopleDataPayload => ({
  payload,
  type: getPeopleData,
})
export const createMarkViewed = (payload: _MarkViewedPayload): MarkViewedPayload => ({
  payload,
  type: markViewed,
})
export const createPeopleDataProcessed = (
  payload: _PeopleDataProcessedPayload
): PeopleDataProcessedPayload => ({payload, type: peopleDataProcessed})
export const createSetResentEmail = (payload: _SetResentEmailPayload): SetResentEmailPayload => ({
  payload,
  type: setResentEmail,
})
export const createSkipTodo = (payload: _SkipTodoPayload): SkipTodoPayload => ({payload, type: skipTodo})

// Action Payloads
export type BadgeAppForWotNotificationsPayload = {
  readonly payload: _BadgeAppForWotNotificationsPayload
  readonly type: typeof badgeAppForWotNotifications
}
export type DismissAnnouncementPayload = {
  readonly payload: _DismissAnnouncementPayload
  readonly type: typeof dismissAnnouncement
}
export type DismissWotNotificationsPayload = {
  readonly payload: _DismissWotNotificationsPayload
  readonly type: typeof dismissWotNotifications
}
export type GetPeopleDataPayload = {
  readonly payload: _GetPeopleDataPayload
  readonly type: typeof getPeopleData
}
export type MarkViewedPayload = {readonly payload: _MarkViewedPayload; readonly type: typeof markViewed}
export type PeopleDataProcessedPayload = {
  readonly payload: _PeopleDataProcessedPayload
  readonly type: typeof peopleDataProcessed
}
export type SetResentEmailPayload = {
  readonly payload: _SetResentEmailPayload
  readonly type: typeof setResentEmail
}
export type SkipTodoPayload = {readonly payload: _SkipTodoPayload; readonly type: typeof skipTodo}

// All Actions
// prettier-ignore
export type Actions =
  | BadgeAppForWotNotificationsPayload
  | DismissAnnouncementPayload
  | DismissWotNotificationsPayload
  | GetPeopleDataPayload
  | MarkViewedPayload
  | PeopleDataProcessedPayload
  | SetResentEmailPayload
  | SkipTodoPayload
  | {type: 'common:resetStore', payload: {}}
