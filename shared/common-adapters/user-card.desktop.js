// @flow
import Avatar from './avatar'
import React from 'react'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './user-card'

const avatarSize = 112

const UserCard = ({
  outerStyle,
  onAvatarClicked,
  username,
  style,
  children,
}: Props) => (
  <div style={{...styleContainer, ...outerStyle}}>
    <Avatar size={avatarSize} onClick={onAvatarClicked} username={username} />
    <div style={{...styleInside, ...style}}>
      {children}
    </div>
  </div>
)

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: 430,
  width: 410,
}

const styleInside = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: globalColors.white,
  borderRadius: 4,
  marginTop: -avatarSize / 2,
  padding: 30,
  paddingTop: 30 + avatarSize / 2,
}

export default UserCard
