import * as RPCTypes from './rpc-gen'
import * as TeamBuildingTypes from './team-building'

import {IconType} from '../../common-adapters/icon.constants-gen'

export type ItemTypeEnum = RPCTypes.HomeScreenItemType
export type ItemType = keyof typeof RPCTypes.HomeScreenItemType

export type ItemID = string
export const itemIDToString: (id: ItemID) => string = id => id
export const stringToItemID: (id: string) => ItemID = id => id

export type TodoTypeEnum = RPCTypes.HomeScreenTodoType
export type TodoType = keyof typeof RPCTypes.HomeScreenTodoType

export type TodoMetaEmail = {
  type: 'email'
  email: string
  lastVerifyEmailDate: number // unix time in seconds
}
export type TodoMetaPhone = {type: 'phone'; phone: string}

export type TodoMeta = TodoMetaEmail | TodoMetaPhone | null

export type Todo = {
  type: 'todo'
  badged: boolean
  todoType: TodoType
  instructions: string
  confirmLabel: string
  dismissable: boolean
  icon: IconType
  metadata: TodoMeta
}

export type FollowedNotification = {
  contactDescription?: string
  username: string
}

export type FollowedNotificationItem = {
  type: 'follow' | 'contact'
  newFollows: Array<FollowedNotification>
  notificationTime: Date
  badged: boolean
  numAdditional?: number
}

export type Announcement = {
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

export type PeopleScreenItem = Todo | FollowedNotificationItem | Announcement

export type FollowSuggestion = {
  username: string
  fullName: string | null
  followsMe: boolean
  iFollow: boolean
}

export type State = Readonly<{
  lastViewed: Date
  version: number
  newItems: Array<PeopleScreenItem>
  oldItems: Array<PeopleScreenItem>
  followSuggestions: Array<FollowSuggestion>
  resentEmail: string
  teamBuilding: TeamBuildingTypes.TeamBuildingSubState
}>
