// @flow
import * as Constants from '../constants/search'
import * as React from 'react'
import {Avatar, Icon} from '../common-adapters'

import type {AvatarSize} from '../common-adapters/avatar'
import type {IconType} from '../common-adapters/icon'

type Props = {|
  service: ?Constants.Service,
  username: ?string,
  icon: ?IconType,
  avatarSize: AvatarSize,
  style?: {},
|}

const IconOrAvatar = ({service, username, icon, avatarSize, style}: Props) =>
  service === 'Keybase'
    ? <Avatar username={username} size={avatarSize} style={style} />
    : icon ? <Icon type={icon} style={style} size={avatarSize - 8} /> : null

export default IconOrAvatar
