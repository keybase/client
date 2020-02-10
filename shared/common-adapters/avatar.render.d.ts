import * as React from 'react'
import {StylesCrossPlatform} from '../styles'
import {IconType, IconStyle} from './icon'

export type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16

export type Props = {
  blocked?: boolean
  borderColor?: string
  children?: React.ReactNode
  editable?: boolean
  following: boolean
  followsYou: boolean
  isTeam: boolean
  loadingColor?: string
  name: string
  onClick?: () => void
  onEditAvatarClick?: (e: React.BaseSyntheticEvent) => void
  opacity?: number
  showFollowingStatus?: boolean
  size: AvatarSize
  skipBackground?: boolean
  skipBackgroundAfterLoaded?: boolean
  style?: StylesCrossPlatform
  url: any
}

export default class Avatar extends React.Component<Props> {}
