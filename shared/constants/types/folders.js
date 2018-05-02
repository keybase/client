// @flow
// TODO(mm) Everytype in this file should be pure...
import type {DeviceType} from './devices'
import type {Folder as FolderRPC} from './rpc-gen'
import type {IconType} from '../../common-adapters/icon'

type UserListItem = {
  username: string,
  readOnly?: boolean,
  broken?: boolean,
  you?: boolean,
  following?: boolean,
}

type UserList = Array<UserListItem>

type FileProps = {|
  theme: 'public' | 'private',
  size?: 'Small' | 'Large', // defaults to Large
  name: string,
  path: string,
  lastModifiedMeta?: string,
  lastModifiedBySelf?: ?boolean,
  lastModifiedBy?: ?string,
  modifiedMarker: boolean,
  fileIcon: IconType,
  onClick: () => void,
|}

export type FileSection = {|
  name: string,
  modifiedMarker: boolean,
  files: Array<FileProps>,
|}

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
  isTeam: boolean,
  ignored: boolean,
  waitingForParticipantUnlock: Array<ParticipantUnlock>,
  youCanUnlock: Array<Device>,
}

export type FolderRPCWithMeta = {
  ...FolderRPC,
  meta: MetaType,
  waitingForParticipantUnlock: Array<ParticipantUnlock>,
  youCanUnlock: Array<Device>,
}
