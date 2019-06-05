import * as React from 'react'
import {StylesCrossPlatform} from '../styles'
import {IconType, IconStyle} from './icon'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16

export type Props = {
  borderColor?: string | null
  children?: React.ReactNode
  editable?: boolean
  followIconSize: number
  followIconType: IconType | null
  followIconStyle: IconStyle
  isTeam: boolean
  load: () => void | null
  name: string
  loadingColor?: string
  onClick?: () => void | null
  onEditAvatarClick?: (e: React.SyntheticEvent) => void | null
  opacity?: number
  size: AvatarSize
  skipBackground?: boolean
  skipBackgroundAfterLoaded?: boolean
  style?: StylesCrossPlatform
  url: any
}

export default class Avatar extends React.Component<Props> {}
