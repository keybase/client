// @flow strict
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import type {IconType} from '../../common-adapters/icon.constants'

export type ItemTypeEnum = RPCTypes.HomeScreenItemType
export type ItemType = $Keys<typeof RPCTypes.homeHomeScreenItemType>

export type ItemID = string
export const itemIDToString: (id: ItemID) => string = id => id
export const stringToItemID: (id: string) => ItemID = id => id

export type TodoTypeEnum = RPCTypes.HomeScreenTodoType
export type TodoType = $Keys<typeof RPCTypes.homeHomeScreenTodoType>

export type _Todo = {
  type: 'todo',
  badged: boolean,
  todoType: TodoType,
  instructions: string,
  confirmLabel: string,
  dismissable: boolean,
  icon: IconType,
}
export type Todo = I.RecordOf<_Todo>

export type _FollowedNotification = {
  username: string,
}
export type FollowedNotification = I.RecordOf<_FollowedNotification>

export type _FollowedNotificationItem = {
  type: 'notification',
  newFollows: Array<FollowedNotification>,
  notificationTime: Date,
  badged: boolean,
  numAdditional?: number,
}
export type FollowedNotificationItem = I.RecordOf<_FollowedNotificationItem>

export type _Announcement = {
  appLink: ?RPCTypes.AppLinkType,
  badged: boolean,
  confirmLabel: ?string,
  dismissable: boolean,
  id: RPCTypes.HomeScreenAnnouncementID,
  iconUrl: ?string,
  text: string,
  type: 'announcement',
  url: ?string,
}

export type Announcement = I.RecordOf<_Announcement>

export type PeopleScreenItem = Todo | FollowedNotificationItem | Announcement

export type _FollowSuggestion = {
  username: string,
  fullName: ?string,
  followsMe: boolean,
  iFollow: boolean,
}
export type FollowSuggestion = I.RecordOf<_FollowSuggestion>

export type _State = {
  lastViewed: Date,
  version: number,
  newItems: I.List<PeopleScreenItem>,
  oldItems: I.List<PeopleScreenItem>,
  followSuggestions: I.List<FollowSuggestion>,
}

export type State = I.RecordOf<_State>
