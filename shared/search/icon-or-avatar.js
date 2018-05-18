// @flow
import * as Types from '../constants/types/search'
import * as React from 'react'
import {Avatar, Icon, type IconType} from '../common-adapters'
import type {AvatarSize} from '../common-adapters/avatar'

type Props = {|
  service: ?Types.Service,
  username: ?string,
  icon: ?IconType,
  avatarSize: AvatarSize,
  style?: any,
  fontSize?: number,
|}

const IconOrAvatar = ({service, username, icon, avatarSize, style, fontSize}: Props) =>
  service === 'Keybase' ? (
    <Avatar username={username} size={avatarSize} style={style} />
  ) : icon ? (
    <Icon type={icon} style={style} size={avatarSize - 8} fontSize={fontSize} />
  ) : null

export default IconOrAvatar
