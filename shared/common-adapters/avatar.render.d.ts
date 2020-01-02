import * as React from 'react'
import {StylesCrossPlatform} from '../styles'
import {IconType, IconStyle} from './icon'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16

export type Props = {
  borderColor?: string
  blocked?: boolean
  children?: React.ReactNode
  editable?: boolean
  followIconSize: number
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
  url: any
}

export default class Avatar extends React.Component<Props> {}
