/* @flow */

export type UserInfo = {
  fullname: string,
  followersCount: number,
  followingCount: number,
  followsYou: boolean,
  avatar: ?string,
  location: string
}

export type BioProps = {
  username: ?string,
  userInfo: ?UserInfo
}
