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

export type State = {
  readonly infoMap: Map<string, UserInfo>
  readonly blockMap: Map<string, BlockState>
}
