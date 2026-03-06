import type * as React from 'react'
import type * as Styles from '@/styles'
import type * as T from '@/constants/types'

type Props = {
  children?: React.ReactNode
  crop?: T.Teams.AvatarCrop
  imageOverrideUrl?: string
  isTeam?: boolean
  onClick?: ((e?: React.BaseSyntheticEvent) => void) | 'profile'
  size: 128 | 96 | 64 | 48 | 32 | 24 | 16
  style?: Styles.CustomStyles<'borderStyle'>
  teamname?: string
  username?: string
}

declare const Avatar2: (p: Props) => React.ReactNode
export default Avatar2
