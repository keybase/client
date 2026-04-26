import type * as React from 'react'
import type * as Styles from '@/styles'
import type * as T from '@/constants/types'

type Props = {
  children?: React.ReactNode | undefined
  crop?: T.Teams.AvatarCrop | undefined
  imageOverrideUrl?: string | undefined
  isTeam?: boolean | undefined
  onClick?: ((e?: React.BaseSyntheticEvent) => void) | 'profile' | undefined
  size: 128 | 96 | 64 | 48 | 32 | 24 | 16
  style?: Styles.CustomStyles<'borderStyle'> | undefined
  teamname?: string | undefined
  username?: string | undefined
}

declare const Avatar: (p: Props) => React.ReactNode
export default Avatar
