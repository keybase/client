import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import {IconType} from '../../common-adapters/icon.constants'

export type ItemTypeEnum = RPCTypes.HomeScreenItemType
export type ItemType = keyof typeof RPCTypes.HomeScreenItemType

export type ItemID = string
export const itemIDToString: (id: ItemID) => string = id => id
export const stringToItemID: (id: string) => ItemID = id => id

export type TodoTypeEnum = RPCTypes.HomeScreenTodoType
export type TodoType = keyof typeof RPCTypes.HomeScreenTodoType

export type _TodoMetaEmail = {type: 'email'; email: string}
export type _TodoMetaPhone = {type: 'phone'; phone: string}

export type TodoMetaEmail = I.RecordOf<_TodoMetaEmail>
export type TodoMetaPhone = I.RecordOf<_TodoMetaPhone>
export type TodoMeta = TodoMetaEmail | TodoMetaPhone | null

export type _Todo = {
  type: 'todo'
  badged: boolean
  todoType: TodoType
  instructions: string
  confirmLabel: string
  dismissable: boolean
  icon: IconType
  metadata: TodoMeta
}
export type Todo = I.RecordOf<_Todo>

export type _FollowedNotification = {
  username: string
}
export type FollowedNotification = I.RecordOf<_FollowedNotification>

export type _FollowedNotificationItem = {
  type: 'notification'
  newFollows: Array<FollowedNotification>
  notificationTime: Date
  badged: boolean
  numAdditional?: number
}
export type FollowedNotificationItem = I.RecordOf<_FollowedNotificationItem>

export type _Announcement = {
  appLink: RPCTypes.AppLinkType | null
  badged: boolean
  confirmLabel: string | null
  dismissable: boolean
  id: RPCTypes.HomeScreenAnnouncementID
  iconUrl: string | null
  text: string
  type: 'announcement'
  url: string | null
}

export type Announcement = I.RecordOf<_Announcement>

export type PeopleScreenItem = Todo | FollowedNotificationItem | Announcement

export type _FollowSuggestion = {
  username: string
  fullName: string | null
  followsMe: boolean
  iFollow: boolean
}
export type FollowSuggestion = I.RecordOf<_FollowSuggestion>

export type _State = {
  lastViewed: Date
  version: number
  newItems: I.List<PeopleScreenItem>
  oldItems: I.List<PeopleScreenItem>
  followSuggestions: I.List<FollowSuggestion>
}

export type State = I.RecordOf<_State>
