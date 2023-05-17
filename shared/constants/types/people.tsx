import type * as RPCTypes from './rpc-gen'
import type * as TeamBuildingTypes from './team-building'
import type {IconType} from '../../common-adapters/icon.constants-gen'

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

export type TodoMeta = TodoMetaEmail | TodoMetaPhone | undefined

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
  appLink?: RPCTypes.AppLinkType
  badged: boolean
  confirmLabel?: string
  dismissable: boolean
  id: RPCTypes.HomeScreenAnnouncementID
  iconUrl?: string
  text: string
  type: 'announcement'
  url?: string
}

export type WotUpdate = {
  voucher: string
  vouchee: string
  status: RPCTypes.WotStatusType
}

export type PeopleScreenItem = Todo | FollowedNotificationItem | Announcement

export type FollowSuggestion = {
  username: string
  fullName?: string
  followsMe: boolean
  iFollow: boolean
}

export type State = {
  readonly lastViewed: Date
  readonly version: number
  readonly newItems: Array<PeopleScreenItem>
  readonly oldItems: Array<PeopleScreenItem>
  readonly wotUpdates: Map<string, WotUpdate>
  readonly followSuggestions: Array<FollowSuggestion>
  readonly resentEmail: string
  readonly teamBuilding: TeamBuildingTypes.TeamBuildingSubState
  readonly inviteCounts: RPCTypes.InviteCounts | undefined
}
