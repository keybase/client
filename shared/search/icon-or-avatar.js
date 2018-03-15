// @flow
import * as Types from '../constants/types/search'
import * as React from 'react'
import {Avatar, Icon} from '../common-adapters'
import {type StylesCrossPlatform} from '../styles'

import type {AvatarSize} from '../common-adapters/avatar'
import type {IconType} from '../common-adapters/icon'

type Props = {|
  service: ?Types.Service,
  username: ?string,
  icon: ?IconType,
  avatarSize: AvatarSize,
  style?: StylesCrossPlatform,
|}

const IconOrAvatar = ({service, username, icon, avatarSize, style}: Props) =>
  service === 'Keybase' ? (
    <Avatar username={username} size={avatarSize} style={style} />
  ) : icon ? (
    <Icon type={icon} style={style} size={avatarSize - 8} />
  ) : null

export default IconOrAvatar
