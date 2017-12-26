// @flow
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'
import {type IconType} from '../../common-adapters/icon.constants'

// 'todo' | 'people'
export type ItemTypeEnum = RPCTypes.HomeScreenItemType
export type ItemType = $Keys<typeof RPCTypes.homeHomeScreenItemType>

export type ItemID = string
export const itemIDToString: (id: ItemID) => string = id => id
export const stringToItemID: (id: string) => ItemID = id => id

// 'none' | 'bio' | 'proof' | 'device' | 'follow' | 'chat' |
// 'paperkey' | 'team' | 'folder' | 'gitRepo' | 'teamShowcase'
export type TodoTypeEnum = RPCTypes.HomeScreenTodoType
export type TodoType = $Keys<typeof RPCTypes.homeHomeScreenTodoType>
export type Todo = {
  type: 'todo',
  badged: boolean,
  todoType: TodoType,
  instructions: string,
  confirmLabel: string,
  dismissable: boolean,
  icon: IconType,
}

export type FollowedNotification = {
  username: string,
}
export type FollowedNotificationItem = {
  type: 'notification',
  newFollows: Array<FollowedNotification>,
  notificationTime: Date,
  badged: boolean,
}

export type PeopleScreenItem = Todo | FollowedNotificationItem

export type FollowSuggestion = {
  uid: RPCTypes.UID,
  username: string,
  bio: string,
  fullName: string,
  pics?: ?RPCTypes.Pics,
}

export type _PeopleScreen = {
  lastViewed: Date,
  version: number,
  newItems: I.List<PeopleScreenItem>,
  oldItems: I.List<PeopleScreenItem>,
  followSuggestions: I.List<FollowSuggestion>,
}

export type PeopleScreen = I.RecordOf<_PeopleScreen>
// TODO clean this up
export type _State = {
  ..._PeopleScreen,
}

export type State = I.RecordOf<_State>
