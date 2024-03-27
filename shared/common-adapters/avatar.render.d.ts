import type * as React from 'react'
import type * as T from '@/constants/types'
import type {StylesCrossPlatform} from '@/styles'
import type {IconType, IconStyle} from './icon'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16

export type Props = {
  borderColor?: string
  blocked?: boolean
  children?: React.ReactNode
  crop?: T.Teams.AvatarCrop
  editable?: boolean
  followIconSize: 28 | 21
  followIconType?: IconType
  followIconStyle: IconStyle
  isTeam: boolean
  name: string
  loadingColor?: string
  onClick?: () => void
  onEditAvatarClick?: (e: React.BaseSyntheticEvent) => void
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  skipBackgroundAfterLoaded?: boolean
  style?: StylesCrossPlatform
  url: string | null
}

declare const Avatar: (p: Props) => React.ReactNode
export default Avatar
