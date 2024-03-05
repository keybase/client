import type * as T from '@/constants/types'
export type GitInfo = {
  canDelete: boolean
  channelName?: string
  chatDisabled: boolean
  devicename: string
  id: string // 'Global Unique ID',
  lastEditTime: string
  lastEditUser: string
  name: string
  repoID: string // repoID daemon is concerned with,
  teamname?: string
  url: string
}

export type State = T.Immutable<{
  readonly error?: Error
  readonly idToInfo: Map<string, GitInfo>
  readonly isNew?: Set<string>
}>
