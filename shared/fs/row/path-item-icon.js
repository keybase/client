// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {Avatar, Icon} from '../../common-adapters'
import memoize from 'lodash/memoize'

type PathItemIconProps = {
  spec: Types.PathItemIconSpec,
  style: any,
}

const PathItemIcon = ({spec, style}: PathItemIconProps) => {
  switch (spec.type) {
    case 'teamAvatar':
      return <Avatar size={32} teamname={spec.teamName} isTeam={true} style={style} />
    case 'avatar':
      return <Avatar size={32} username={spec.username} style={style} />
    case 'avatars':
      // Use first avatar for now.
      // TODO: fix this when we have support for three avatars as in design.
      return <Avatar size={32} username={spec.usernames[0]} style={style} />
    case 'basic':
      return <Icon type={spec.iconType} style={basicIconStyles(spec.iconColor, style)} />
    default:
      return null
  }
}

// memoize uses first arg as cache key, so aggregate both parameters into an
// object to avoid having a custom cache resolving function.
const basicIconStyles = (color, appendStyle) =>
  memoize(({color, appendStyle}) => ({
    color,
    ...(appendStyle || {}),
  }))({color, appendStyle})

export default PathItemIcon
