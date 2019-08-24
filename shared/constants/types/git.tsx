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

export type State = Readonly<{
  error?: Error
  idToInfo: Map<string, GitInfo>
  isNew: Set<string>
}>
