import * as Types from '../constants/types/search'
import * as React from 'react'
import {Avatar, Icon, IconType} from '../common-adapters'
import {AvatarSize} from '../common-adapters/avatar'

type Props = {
  service?: Types.Service
  username?: string
  icon?: IconType
  opacity?: number
  avatarSize: AvatarSize
  style?: any
  fontSize?: number
}

const IconOrAvatar = ({service, username, icon, opacity, avatarSize, style, fontSize}: Props) =>
  service === 'Keybase' ? (
    <Avatar opacity={opacity} username={username} size={avatarSize} style={style} />
  ) : icon ? (
    <Icon type={icon} style={style} fontSize={fontSize} />
  ) : null

export default IconOrAvatar
