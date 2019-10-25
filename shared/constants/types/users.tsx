// Info about users we get from various places. Fullname, broken, etc
export type UserInfo = {
  bio?: string
  broken?: boolean
  fullname?: string
}

export type State = Readonly<{
  infoMap: Map<string, UserInfo>
}>
