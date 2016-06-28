/* @flow */

// TODO(mm) Everytype in this file should be pure...

import type {UserList} from '../common-adapters/usernames'
import type {IconType} from '../common-adapters/icon'
import type {Props as FileProps} from '../folders/files/file/render'

export type FileSection = {
  name: string,
  modifiedMarker: boolean,
  files: Array<FileProps>
}

export type ParticipantUnlock = {
  name: string,
  devices: string,
  onClick: () => void
}

export type UnlockDevice = {
  name: string,
  icon: IconType,
  onClickPaperkey?: () => void
}

export type Folder = {
  users: UserList,
  path: string,
  meta?: 'new' | 'rekey' | null,
  modified?: {
    when: string,
    username: string
  },
  isPublic: boolean,
  ignored: boolean,
  hasData: boolean,
  groupAvatar: boolean,
  userAvatar: ?string,
  recentFiles: Array<FileSection>, // TODO make pure
  waitingForParticipantUnlock: Array<ParticipantUnlock>, // TODO make pure
  youCanUnlock: Array<UnlockDevice> // TODO make pure
}
