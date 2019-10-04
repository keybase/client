// Info about users we get from various places. Fullname, broken, etc
export type UserInfo = {
  broken: boolean
  fullname: string
}

export type State = {
  infoMap: Map<string, UserInfo>
}
