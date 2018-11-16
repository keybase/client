// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import {Avatar, avatarCastPlatformStyles, Icon, iconCastPlatformStyles} from '../../common-adapters'

type PathItemIconProps = {
  spec: Types.PathItemIconSpec,
  style?: Styles.StylesCrossPlatform,
  // 12 is not supported by Avatar. But we only use it in destination picker for
  // targets, which cannot be an avatar. So accept it anyway, but override it
  // into 16 if it's an Avatar.
  size?: 32 | 16 | 12,
}

const getSizeForAvatar = (size?: 32 | 16 | 12) => (size === 12 ? 16 : size || 32)

const PathItemIcon = ({spec, style, size}: PathItemIconProps) => {
  switch (spec.type) {
    case 'teamAvatar':
      return (
        <Avatar
          size={getSizeForAvatar(size)}
          teamname={spec.teamName}
          isTeam={true}
          style={style && avatarCastPlatformStyles(style)}
        />
      )
    case 'avatar':
      return (
        <Avatar
          size={getSizeForAvatar(size)}
          username={spec.username}
          style={style && avatarCastPlatformStyles(style)}
        />
      )
    case 'avatars':
      // Use first avatar for now.
      // TODO: fix this when we have support for three avatars as in design.
      return (
        <Avatar
          size={getSizeForAvatar(size)}
          username={spec.usernames[0]}
          style={style && avatarCastPlatformStyles(style)}
        />
      )
    case 'basic':
      return (
        <Icon
          type={spec.iconType}
          style={iconCastPlatformStyles(
            Styles.collapseStyles([
              !!size && {
                width: size,
                height: size,
              },
              style,
            ])
          )}
          color={spec.iconColor}
        />
      )
    default:
      return null
  }
}

export default PathItemIcon
