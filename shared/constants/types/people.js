// @flow
import * as I from 'immutable'
import * as RPCTypes from './flow-types'

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
export type HomeScreenTodo = {t: TodoType}

export type FollowedNotification = {
  followTime: Date,
  user: RPCTypes.UserSummary,
}
export type MultiFollowedNotification = {
  followers: Array<FollowedNotification>,
  numOthers: number,
}
export type FollowedNotificationItem =
  | {t: 'single', followed: FollowedNotification}
  | {t: 'multi', followedMulti: MultiFollowedNotification}

export type PeopleScreenItem =
  | {
      badged: boolean,
      type: 'todo',
      todo: HomeScreenTodo,
    }
  | {
      badged: boolean,
      type: 'notification',
      notificiation: FollowedNotificationItem,
    }

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
  items: Array<PeopleScreenItem>,
  followSuggestions?: ?Array<FollowSuggestion>,
}

export type PeopleScreen = I.RecordOf<_PeopleScreen>

export type _State = {
  data: PeopleScreen,
}

export type State = I.RecordOf<_State>
