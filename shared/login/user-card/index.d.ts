import type * as React from 'react'
import type {AvatarSize} from '@/common-adapters/avatar'
import type * as Kb from '@/common-adapters'

export type Props = {
  avatarSize?: AvatarSize
  avatarBackgroundStyle?: any
  lighterPlaceholders?: boolean
  onAvatarClicked?: () => void
  outerStyle?: Kb.Styles.StylesCrossPlatform
  style?: Kb.Styles.StylesCrossPlatform
  username?: string
  children?: React.ReactNode
}

declare const UserCard: (p: Props) => React.ReactNode
export default UserCard
