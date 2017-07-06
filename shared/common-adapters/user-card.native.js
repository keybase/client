// @flow
import Avatar from './avatar'
import React from 'react'
import Box from './box'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './user-card'

const avatarSize = 80

const UserCard = ({outerStyle, onAvatarClicked, username, style, children}: Props) =>
  <Box style={{...styleContainer, ...outerStyle}}>
    <Box style={styleAvatar}>
      <Box style={styleAvatarBackground} />
      <Avatar size={avatarSize} onClick={onAvatarClicked} username={username} />
    </Box>
    <Box style={{...styleInside, ...style}}>
      {children}
    </Box>
  </Box>

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
}

const styleInside = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: globalColors.white,
  justifyContent: 'flex-start',
  padding: 16,
}

const styleAvatar = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  marginTop: 0,
}

const styleAvatarBackground = {
  backgroundColor: globalColors.white,
  height: avatarSize / 2,
  left: 0,
  position: 'absolute',
  right: 0,
  top: avatarSize / 2,
}

export default UserCard
