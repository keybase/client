// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/people'

// Constants
export const resetStore = 'common:resetStore' // not a part of people but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'people:'
export const dismissAnnouncement = 'people:dismissAnnouncement'
export const getPeopleData = 'people:getPeopleData'
export const markViewed = 'people:markViewed'
export const peopleDataProcessed = 'people:peopleDataProcessed'
export const skipTodo = 'people:skipTodo'

// Payload Types
type _DismissAnnouncementPayload = {readonly id: RPCTypes.HomeScreenAnnouncementID}
type _GetPeopleDataPayload = {readonly markViewed: boolean; readonly numFollowSuggestionsWanted: number}
type _MarkViewedPayload = void
type _PeopleDataProcessedPayload = {
  readonly oldItems: I.List<Types.PeopleScreenItem>
  readonly newItems: I.List<Types.PeopleScreenItem>
  readonly followSuggestions: I.List<Types.FollowSuggestion>
  readonly lastViewed: Date
  readonly version: number
}
type _SkipTodoPayload = {readonly type: Types.TodoType}

// Action Creators
export const createDismissAnnouncement = (
  payload: _DismissAnnouncementPayload
): DismissAnnouncementPayload => ({payload, type: dismissAnnouncement})
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
export const createSkipTodo = (payload: _SkipTodoPayload): SkipTodoPayload => ({payload, type: skipTodo})

// Action Payloads
export type DismissAnnouncementPayload = {
  readonly payload: _DismissAnnouncementPayload
  readonly type: typeof dismissAnnouncement
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
export type SkipTodoPayload = {readonly payload: _SkipTodoPayload; readonly type: typeof skipTodo}

// All Actions
// prettier-ignore
export type Actions =
  | DismissAnnouncementPayload
  | GetPeopleDataPayload
  | MarkViewedPayload
  | PeopleDataProcessedPayload
  | SkipTodoPayload
  | {type: 'common:resetStore', payload: {}}
