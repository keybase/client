// @flow
import {defaultKBFSPath} from './config'
import {FavoriteFolderType} from '../constants/types/flow-types'
import {parseFolderNameToUsers, sortUserList} from '../util/kbfs'

import type {Exact} from '../constants/types/more'
import type {Folder as FolderRPC, FuseStatus, InstallResult} from '../constants/types/flow-types'
import type {Folder, MetaType, FolderRPCWithMeta} from './folders'
import type {TypedAction, NoErrorTypedAction} from './types/flux'
import type {UserList} from '../common-adapters/usernames'

type ListState = Exact<{
  tlfs?: Array<Folder>,
  ignored?: Array<Folder>,
  isPublic: boolean,
  style?: any,
  smallMode?: boolean,
  onClick?: (path: string) => void,
  onRekey?: (path: string) => void,
  onOpen?: (path: string) => void,
  extraRows?: Array<React$Element<*>>,
}>

export type FolderState = Exact<{
  privateBadge: number,
  private: ListState,
  publicBadge: number,
  public: ListState,
}>

export type ViewState = Exact<{
  showingPrivate: boolean,
  publicIgnoredOpen: boolean,
  privateIgnoredOpen: boolean,
}>

export type KBFSStatus = {
  isAsyncWriteHappening: boolean,
}

export type State = Exact<{
  folderState: FolderState,
  fuseStatus: {
    loading: boolean,
    status: ?FuseStatus,
  },
  kbfsInstall: {
    installing: boolean,
    result: ?InstallResult,
  },
  kbfsStatus: KBFSStatus,
  viewState: ViewState,
}>

export const favoriteAdd = 'favorite:favoriteAdd'
export type FavoriteAdd = NoErrorTypedAction<'favorite:favoriteAdd', {path: string}>
export const favoriteAdded = 'favorite:favoriteAdded'
export type FavoriteAdded = TypedAction<'favorite:favoriteAdded', void, {errorText: string}>

export const favoriteList = 'favorite:favoriteList'
export type FavoriteList = NoErrorTypedAction<'favorite:favoriteList', void>
export const favoriteListed = 'favorite:favoriteListed'
export type FavoriteListed = TypedAction<'favorite:favoriteListed', {folders: FolderState}, void>

export const favoriteIgnore = 'favorite:favoriteIgnore'
export type FavoriteIgnore = NoErrorTypedAction<'favorite:favoriteIgnore', {path: string}>
export const favoriteIgnored = 'favorite:favoriteIgnored'
export type FavoriteIgnored = TypedAction<'favorite:favoriteIgnored', void, {errorText: string}>

export const favoriteSwitchTab = 'favorite:favoriteSwitchTab'
export type FavoriteSwitchTab = TypedAction<'favorite:favoriteSwitchTab', {showingPrivate: boolean}, void>

export const favoriteToggleIgnored = 'favorite:favoriteToggleIgnored'
export type FavoriteToggleIgnored = TypedAction<'favorite:favoriteToggleIgnored', {isPrivate: boolean}, void>

export const kbfsStatusUpdated = 'favorite:kbfsStatusUpdated'
export type KbfsStatusUpdated = TypedAction<'favorite:kbfsStatusUpdated', KBFSStatus, void>

export const markTLFCreated = 'favorite:markTLFCreated'
export type MarkTLFCreated = TypedAction<'favorite:markTLFCreated', {folder: Folder}, void>

export const setupKBFSChangedHandler = 'favorite:setupKBFSChangedHandler'
export type SetupKBFSChangedHandler = NoErrorTypedAction<'favorite:setupKBFSChangedHandler', void>

export type FavoriteAction =
  | FavoriteAdd
  | FavoriteAdded
  | FavoriteList
  | FavoriteListed
  | FavoriteIgnore
  | FavoriteIgnored
  | FavoriteSwitchTab
  | FavoriteToggleIgnored
  | KbfsStatusUpdated

// Sometimes we have paths that are just private/foo instead of /keybase/private/foo
function canonicalizeTLF(tlf: string): string {
  if (tlf.indexOf(defaultKBFSPath) !== 0) {
    return `${defaultKBFSPath}/${tlf}`
  }
  return tlf
}

function pathFromFolder({
  isPublic,
  users,
}: {
  isPublic: boolean,
  users: UserList,
}): {sortName: string, path: string} {
  const rwers = users.filter(u => !u.readOnly).map(u => u.username)
  const readers = users.filter(u => !!u.readOnly).map(u => u.username)
  const sortName = rwers.join(',') + (readers.length ? `#${readers.join(',')}` : '')
  const path = `${defaultKBFSPath}/${isPublic ? 'public' : 'private'}/${sortName}`
  return {sortName, path}
}

function folderRPCFromPath(path: string): ?FolderRPC {
  if (path.startsWith(`${defaultKBFSPath}/private/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/private/`, ''),
      private: true,
      notificationsOn: false,
      created: false,
      folderType: FavoriteFolderType.private,
    }
  } else if (path.startsWith(`${defaultKBFSPath}/public/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/public/`, ''),
      private: false,
      notificationsOn: false,
      created: false,
      folderType: FavoriteFolderType.public,
    }
  } else {
    return null
  }
}

function folderFromFolderRPCWithMeta(username: string, f: FolderRPCWithMeta): Folder {
  const users = sortUserList(parseFolderNameToUsers(username, f.name))

  const {sortName, path} = pathFromFolder({users, isPublic: !f.private})
  const meta: MetaType = f.meta
  const ignored = f.meta === 'ignored'

  return {
    path,
    users,
    sortName,
    hasData: false, // TODO don't have this info
    isPublic: !f.private,
    ignored,
    meta,
    recentFiles: [],
    waitingForParticipantUnlock: f.waitingForParticipantUnlock,
    youCanUnlock: f.youCanUnlock,
  }
}

function folderFromFolderRPC(username: string, f: FolderRPC): Folder {
  return folderFromFolderRPCWithMeta(username, {
    ...f,
    waitingForParticipantUnlock: [],
    youCanUnlock: [],
    meta: null,
  })
}

function folderFromPath(username: string, path: string): ?Folder {
  const folderRPC = folderRPCFromPath(canonicalizeTLF(path))
  if (folderRPC == null) {
    return null
  } else {
    return folderFromFolderRPC(username, folderRPC)
  }
}

export type {Folder as FolderRPC} from '../constants/types/flow-types'

export {
  canonicalizeTLF,
  folderFromFolderRPCWithMeta,
  folderFromFolderRPC,
  folderFromPath,
  folderRPCFromPath,
  pathFromFolder,
}
