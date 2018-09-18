// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/fs'
import {Avatar, avatarCastPlatformStyles, Icon, iconCastPlatformStyles} from '../../common-adapters'

type PathItemIconProps = {
  spec: Types.PathItemIconSpec,
  style: Styles.StylesCrossPlatform,
  small?: boolean,
}

const PathItemIcon = ({spec, style, small}: PathItemIconProps) => {
  switch (spec.type) {
    case 'teamAvatar':
      return (
        <Avatar
          size={small ? 16 : 32}
          teamname={spec.teamName}
          isTeam={true}
          style={avatarCastPlatformStyles(style)}
        />
      )
    case 'avatar':
      return (
        <Avatar size={small ? 16 : 32} username={spec.username} style={avatarCastPlatformStyles(style)} />
      )
    case 'avatars':
      // Use first avatar for now.
      // TODO: fix this when we have support for three avatars as in design.
      return (
        <Avatar size={small ? 16 : 32} username={spec.usernames[0]} style={avatarCastPlatformStyles(style)} />
      )
    case 'basic':
      return (
        <Icon
          type={spec.iconType}
          style={iconCastPlatformStyles(small ? Styles.collapseStyles([styles.basicIcon, style]) : style)}
          color={spec.iconColor}
        />
      )
    default:
      return null
  }
}

const styles = Styles.styleSheetCreate({
  basicIcon: {
    width: 16,
    height: 16,
  },
})

export default PathItemIcon
