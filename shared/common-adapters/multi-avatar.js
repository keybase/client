// @flow
// Simple control to show multiple avatars. Just used in chat but could be expanded. Keeping this simple for now
import Avatar from './avatar'
import Box from './box'
import React from 'react'

import type {Props as AvatarProps, AvatarSize} from './avatar'

export type Props = {
  avatarProps: Array<AvatarProps>,
  singleSize: AvatarSize,
  multiSize: AvatarSize,
  style?: ?Object,
}

const MultiAvatar = ({avatarProps, singleSize, multiSize, style}: Props) => {
  if (avatarProps.length < 0) {
    return null
  }
  if (avatarProps.length > 2) {
    console.warn('MultiAvatar only handles up to 2 avatars')
    return null
  }

  const leftProps: AvatarProps = avatarProps[0]
  const rightProps: AvatarProps = avatarProps[1]

  if (avatarProps.length === 1) {
    return <Avatar {...leftProps} size={singleSize} />
  }

  return (
    <Box style={{...containerStyle, ...style}}>
      <Avatar {...leftProps} style={leftAvatar} size={multiSize} />
      <Avatar {...rightProps} style={rightAvatar} size={multiSize} />
    </Box>
  )
}

const containerStyle = {
  position: 'relative',
  width: 32,
}

const leftAvatar = {
}

const rightAvatar = {
  marginLeft: 8,
  marginTop: -16,
}

export default MultiAvatar
