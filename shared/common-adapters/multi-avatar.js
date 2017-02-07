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
  if (avatarProps.length <= 0) {
    return null
  }
  if (avatarProps.length > 2) {
    console.warn('MultiAvatar only handles up to 2 avatars')
    return null
  }

  const leftProps: AvatarProps = avatarProps[1]
  const rightProps: AvatarProps = avatarProps[0]

  if (avatarProps.length === 1) {
    return <Avatar {...rightProps} size={singleSize} />
  }

  return (
    <Box style={{...containerStyle, ...style}}>
      <Avatar {...leftProps} style={{...leftAvatar, ...leftProps.style}} size={multiSize} />
      <Avatar {...rightProps} style={{...rightAvatar, ...rightProps.style}} size={multiSize} />
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
