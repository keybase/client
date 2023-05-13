import * as React from 'react'
import {AvatarSize} from '../../common-adapters/avatar'
import * as Styles from '../../styles'

export type Props = {
  avatarSize: AvatarSize
  avatarBackgroundStyle?: any
  lighterPlaceholders?: boolean
  onAvatarClicked?: () => void
  outerStyle?: Styles.StylesCrossPlatform
  style?: Styles.StylesCrossPlatform
  username?: string
  children?: React.ReactNode
}

declare class UserCard extends React.Component<Props> {
  static defaultProps: {avatarSize: number}
}
export default UserCard
