import * as React from 'react'
import * as Styles from '../styles'
import Avatar from './avatar'
import Box from './box'

import {Props} from './user-card'

const Kb = {
  Avatar,
  Box,
}

const avatarSize = 96

const UserCard = ({outerStyle, onAvatarClicked, username, style, children}: Props) => (
  <Kb.Box style={{...styleContainer, ...outerStyle}}>
    <Kb.Box style={styleAvatar}>
      <Kb.Box style={styleAvatarBackground} />
      <Kb.Avatar size={avatarSize} onClick={onAvatarClicked} username={username} />
    </Kb.Box>
    <Kb.Box style={{...styleInside, ...style}}>{children}</Kb.Box>
  </Kb.Box>
)

const styleContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'stretch',
}

const styleInside = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: Styles.globalColors.white,
  justifyContent: 'flex-start',
  padding: 16,
}

const styleAvatar = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  marginTop: 0,
}

const styleAvatarBackground = {
  backgroundColor: Styles.globalColors.white,
  height: avatarSize / 2,
  left: 0,
  position: 'absolute',
  right: 0,
  top: avatarSize / 2,
}

export default UserCard
