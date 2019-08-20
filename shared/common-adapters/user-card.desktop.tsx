import Avatar from './avatar'
import * as React from 'react'
import * as Styles from '../styles'

import {Props} from './user-card'

const Kb = {
  Avatar,
}

const avatarSize = 128

const UserCard = ({outerStyle, onAvatarClicked, username, style, children}: Props) => (
  <div style={{...styleContainer, ...outerStyle}}>
    <Kb.Avatar size={avatarSize} onClick={onAvatarClicked} username={username} />
    <div style={{...styleInside, ...style}}>{children}</div>
  </div>
)

const styleContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: 430,
  width: 410,
}

const styleInside = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: Styles.globalColors.white,
  borderRadius: 4,
  marginTop: -avatarSize / 2,
  padding: 30,
  paddingTop: 30 + avatarSize / 2,
}

export default UserCard
