import type * as React from 'react'
import type * as T from '@/constants/types'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16

export type Props = {
  borderColor?: string
  children?: React.ReactNode
  crop?: T.Teams.AvatarCrop
  lighterPlaceholders?: boolean
  editable?: boolean
  imageOverrideUrl?: string
  isTeam?: boolean
  loadingColor?: string
  onClick?: ((e?: React.BaseSyntheticEvent) => void) | 'profile'
  onEditAvatarClick?: (e?: React.BaseSyntheticEvent) => void
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  style?: Styles.CustomStyles<'borderStyle'>
  teamname?: string
  username?: string
  showFollowingStatus?: boolean // show the green dots or not
}

declare const Avatar: (p: Props) => React.ReactNode
export default Avatar
