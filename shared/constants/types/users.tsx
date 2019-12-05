// Info about users we get from various places. Fullname, broken, etc
export type UserInfo = {
  bio?: string
  broken?: boolean
  fullname?: string
}

export type BlockState = {
  chatBlocked: boolean
  followBlocked: boolean
}

export type State = Readonly<{
  infoMap: Map<string, UserInfo>
  blockMap: Map<string, BlockState>
}>
