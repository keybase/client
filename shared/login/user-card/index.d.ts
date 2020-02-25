import * as React from 'react'
import {AvatarSize} from '../../common-adapters/avatar'

export type Props = {
  avatarSize: AvatarSize
  avatarBackgroundStyle?: any
  lighterPlaceholders?: boolean
  onAvatarClicked?: () => void
  outerStyle?: Object | null
  style?: any
  username?: string
  children?: React.ReactNode
}

declare class UserCard extends React.Component<Props> {
  static defaultProps: {avatarSize: number}
}
export default UserCard
