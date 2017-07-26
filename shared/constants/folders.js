// @flow
// TODO(mm) Everytype in this file should be pure...
import type {UserList} from '../common-adapters/usernames'
import type {Props as FileProps} from '../folders/files/file/render'
import type {DeviceType} from '../constants/types/more'
import type {Folder as FolderRPC} from '../constants/types/flow-types'

export type FileSection = {
  name: string,
  modifiedMarker: boolean,
  files: Array<FileProps>,
}

export type ParticipantUnlock = {
  name: string,
  devices: string,
}

export type Device = {
  type: DeviceType,
  name: string,
  deviceID: string,
}

export type MetaType = 'new' | 'rekey' | 'ignored' | null

export type Folder = {
  users: UserList,
  path: string,
  sortName: string,
  meta?: MetaType,
  modified?: {
    when: string,
    username: string,
  },
  isPublic: boolean,
  ignored: boolean,
  hasData: boolean,
  recentFiles: Array<FileSection>, // TODO make pure
  waitingForParticipantUnlock: Array<ParticipantUnlock>,
  youCanUnlock: Array<Device>,
}

export type FolderRPCWithMeta = {
  meta: MetaType,
  waitingForParticipantUnlock: Array<ParticipantUnlock>,
  youCanUnlock: Array<Device>,
} & FolderRPC
