// @flow
import * as RPCTypes from '../constants/types/flow-types'
import {defaultKBFSPath} from './config'
import {parseFolderNameToUsers, sortUserList} from '../util/kbfs'
import type {Exact} from '../constants/types/more'
import type {Folder, MetaType, FolderRPCWithMeta} from './folders'
import type {UserList} from '../common-adapters/usernames'

// See KBDefines.h: KBExitFuseKextError
export const ExitCodeFuseKextError = 4
// See KBDefines.h: KBExitFuseKextPermissionError
export const ExitCodeFuseKextPermissionError = 5

type ListState = any
// TODO this is super messy and there some entangled flow error. let's revisit this soon
/* {
  tlfs?: Array<Folder>,
  ignored?: Array<Folder>,
  isPublic: boolean,
  style?: any,
  smallMode?: boolean,
  onClick?: (path: string) => void,
  onRekey?: (path: string) => void,
  onOpen?: (path: string) => void,
  onChat?: (tlf: string) => void,
  onToggleShowIgnored?: ?() => void,
  showIgnored?: boolean,
  extraRows?: Array<React.Node>,
} */

export type FolderState = {
  privateBadge: number,
  private: ListState,
  publicBadge: number,
  public: ListState,
}

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
  fuseInstalling: boolean,
  fuseStatus: ?RPCTypes.FuseStatus,
  fuseStatusLoading: boolean,
  kbfsInstalling: boolean,
  kbfsOpening: boolean,
  kbfsStatus: KBFSStatus,
  kextPermissionError: boolean,
  viewState: ViewState,
}>

const initialState: State = {
  folderState: {
    private: {
      isPublic: false,
      tlfs: [],
    },
    privateBadge: 0,
    public: {
      isPublic: true,
      tlfs: [],
    },
    publicBadge: 0,
  },
  fuseInstalling: false,
  fuseStatus: null,
  fuseStatusLoading: false,
  kbfsInstalling: false,
  kbfsOpening: false,
  kbfsStatus: {
    isAsyncWriteHappening: false,
  },
  kextPermissionError: false,
  viewState: {
    privateIgnoredOpen: false,
    publicIgnoredOpen: false,
    showingPrivate: true,
  },
}

// Sometimes we have paths that are just private/foo instead of /keybase/private/foo
function canonicalizeTLF(tlf: string): string {
  if (tlf.indexOf(defaultKBFSPath) !== 0) {
    return `${defaultKBFSPath}/${tlf}`
  }
  return tlf
}

function pathFromFolder({
  isPublic,
  isTeam,
  users,
}: {
  isPublic: boolean,
  isTeam: boolean,
  users: UserList,
}): {sortName: string, path: string} {
  const rwers = users.filter(u => !u.readOnly).map(u => u.username)
  const readers = users.filter(u => !!u.readOnly).map(u => u.username)
  const sortName = rwers.join(',') + (readers.length ? `#${readers.join(',')}` : '')

  let subdir = 'unknown'
  if (isTeam) {
    subdir = 'team'
  } else if (isPublic) {
    subdir = 'public'
  } else {
    subdir = 'private'
  }

  const path = `${defaultKBFSPath}/${subdir}/${sortName}`
  return {sortName, path}
}

function folderRPCFromPath(path: string): ?RPCTypes.Folder {
  if (path.startsWith(`${defaultKBFSPath}/private/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/private/`, ''),
      private: true,
      notificationsOn: false,
      created: false,
      folderType: RPCTypes.favoriteFolderType.private,
    }
  } else if (path.startsWith(`${defaultKBFSPath}/public/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/public/`, ''),
      private: false,
      notificationsOn: false,
      created: false,
      folderType: RPCTypes.favoriteFolderType.public,
    }
  } else if (path.startsWith(`${defaultKBFSPath}/team/`)) {
    return {
      name: path.replace(`${defaultKBFSPath}/team/`, ''),
      private: true,
      notificationsOn: false,
      created: false,
      folderType: RPCTypes.favoriteFolderType.team,
    }
  } else {
    return null
  }
}

function folderFromFolderRPCWithMeta(username: string, f: FolderRPCWithMeta): Folder {
  const users = sortUserList(parseFolderNameToUsers(username, f.name))

  const {sortName, path} = pathFromFolder({
    users,
    isPublic: !f.private,
    isTeam: f.folderType === RPCTypes.favoriteFolderType.team,
  })
  const meta: MetaType = f.meta
  const ignored = f.meta === 'ignored'

  return {
    path,
    users,
    sortName,
    hasData: false, // TODO don't have this info
    isPublic: !f.private,
    isTeam: f.folderType === RPCTypes.favoriteFolderType.team,
    ignored,
    meta,
    recentFiles: [],
    waitingForParticipantUnlock: f.waitingForParticipantUnlock,
    youCanUnlock: f.youCanUnlock,
  }
}

function folderFromFolderRPC(username: string, f: RPCTypes.Folder): Folder {
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
  initialState,
  folderFromFolderRPCWithMeta,
  folderFromFolderRPC,
  folderFromPath,
  folderRPCFromPath,
  pathFromFolder,
}
