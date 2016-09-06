// @flow
import {defaultKBFSPath} from './config'

import type {$Exact} from './types/more'
import type {Folder as FolderRPC} from '../constants/types/flow-types'
import type {Folder, ParticipantUnlock, Device, MetaType} from './folders'
import type {TypedAction} from './types/flux'
import type {UserList} from '../common-adapters/usernames'

type ListState = $Exact<{
  tlfs?: Array<Folder>,
  ignored?: Array<Folder>,
  isPublic: boolean,
  style?: any,
  smallMode?: boolean,
  onClick?: (path: string) => void,
  onRekey?: (path: string) => void,
  onOpen?: (path: string) => void,
  extraRows?: Array<React$Element<*>>
}>

export type FolderState = $Exact<{
  privateBadge: number,
  private: ListState,
  publicBadge: number,
  public: ListState,
}>

export type ViewState = $Exact<{
  showingPrivate: boolean,
  publicIgnoredOpen: boolean,
  privateIgnoredOpen: boolean,
}>

export type FavoriteState = $Exact<{
  folderState: FolderState,
  viewState: ViewState,
}>

export const favoriteGet = 'favorite:favoriteGet'
export type FavoriteGet = TypedAction<'favorite:favoriteGet', void, void>

export const favoriteAdd = 'favorite:favoriteAdd'
export type FavoriteAdd = TypedAction<'favorite:favoriteAdd', void, {errorText: string}>

export const favoriteList = 'favorite:favoriteList'
export type FavoriteList = TypedAction<'favorite:favoriteList', {folders: FolderState}, void>

export const favoriteIgnore = 'favorite:favoriteIgnore'
export type FavoriteIgnore = TypedAction<'favorite:favoriteIgnore', void, {errorText: string}>

export const favoriteSwitchTab = 'favorite:favoriteSwitchTab'
export type FavoriteSwitchTab = TypedAction<'favorite:favoriteSwitchTab', {showingPrivate: boolean}, void>

export const favoriteToggleIgnored = 'favorite:favoriteToggleIgnored'
export type FavoriteToggleIgnored = TypedAction<'favorite:favoriteToggleIgnored', {isPrivate: boolean}, void>

export type FavoriteAction = FavoriteGet | FavoriteAdd | FavoriteList | FavoriteIgnore | FavoriteSwitchTab | FavoriteToggleIgnored

function pathFromFolder ({isPublic, users}: {isPublic: boolean, users: UserList}) {
  const sortName = users.map(u => u.username).join(',')
  const path = `${defaultKBFSPath}/${isPublic ? 'public' : 'private'}/${sortName}`
  return {sortName, path}
}

export type FolderWithMeta = {
  meta: MetaType,
  waitingForParticipantUnlock: Array<ParticipantUnlock>,
  youCanUnlock: Array<Device>,
} & FolderRPC

function folderFromPath (path: string): ?FolderRPC {
  if (path.startsWith(`${defaultKBFSPath}/private/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/private/`, ''),
      private: true,
      notificationsOn: false,
      created: false,
    }
  } else if (path.startsWith(`${defaultKBFSPath}/public/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/public/`, ''),
      private: false,
      notificationsOn: false,
      created: false,
    }
  } else {
    return null
  }
}

export {
  folderFromPath,
  pathFromFolder,
}
