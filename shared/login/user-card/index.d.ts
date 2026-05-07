import type * as React from 'react'
import type * as Kb from '@/common-adapters'

export type Props = {
  avatarSize?: 128 | 96 | 64 | 48 | 32 | 24 | 16
  avatarBackgroundStyle?: Kb.Styles.StylesCrossPlatform
  onAvatarClicked?: () => void
  outerStyle?: Kb.Styles.StylesCrossPlatform
  style?: Kb.Styles.StylesCrossPlatform
  username?: string
  children?: React.ReactNode
}

declare const UserCard: (p: Props) => React.ReactNode
export default UserCard
