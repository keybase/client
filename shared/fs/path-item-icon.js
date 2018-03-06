// @flow
import * as React from 'react'
import * as Types from '../constants/types/fs'
import {globalMargins} from '../styles'
import {Avatar, Icon} from '../common-adapters'
import memoize from 'lodash/memoize'

type PathItemIconProps = {
  spec: Types.PathItemIconSpec,
}

const PathItemIcon = ({spec}: PathItemIconProps) => {
  switch (spec.type) {
    case 'teamAvatar':
      return <Avatar size={32} teamname={spec.teamName} isTeam={true} style={iconStyle} />
    case 'avatar':
      return <Avatar size={32} username={spec.username} style={iconStyle} />
    case 'avatars':
      // Use first avatar for now.
      // TODO: fix this when we have support for three avatars as in design.
      return <Avatar size={32} username={spec.usernames[0]} style={iconStyle} />
    case 'basic':
      return <Icon type={spec.iconType} style={basicIconStyles(spec.iconColor)} />
    default:
      return null
  }
}

const iconStyle = {
  marginRight: globalMargins.small,
}

const basicIconStyles = memoize(color => ({
  color,
  fontSize: 32,
  ...iconStyle,
}))

export default PathItemIcon
