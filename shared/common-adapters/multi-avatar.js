// @flow
// Simple control to show multiple avatars. Just used in chat but could be expanded. Keeping this simple for now
import Avatar from './avatar'
import Box from './box'
import * as React from 'react'
import {globalStyles} from '../styles'
import memoize from 'lodash/memoize'

import type {Props as AvatarProps, AvatarSize} from './avatar'

export type Props = {
  avatarProps: Array<AvatarProps>,
  singleSize: AvatarSize,
  multiSize: AvatarSize,
  style?: ?Object,
  multiPadding?: number,
}

class MultiAvatar extends React.PureComponent<Props> {
  render() {
    const {avatarProps, singleSize, multiSize, style, multiPadding} = this.props
    if (avatarProps.length <= 0) {
      return null
    }
    if (avatarProps.length > 2) {
      console.warn('MultiAvatar only handles up to 2 avatars')
      return null
    }

    const leftProps: AvatarProps = avatarProps[1]
    const rightProps: AvatarProps = avatarProps[0]

    const backgroundColor = this.props.style && this.props.style.backgroundColor
    if (avatarProps.length === 1) {
      return (
        <Box style={singleStyle}>
          <Avatar style={rightStyle(rightProps.style, backgroundColor)} {...rightProps} size={singleSize} />
        </Box>
      )
    }

    return (
      <Box style={{height: '100%', position: 'relative', width: '100%', ...style}}>
        <Avatar {...leftProps} style={leftAvatar(multiPadding, leftProps.style)} size={multiSize} />
        <Avatar {...rightProps} style={rightAvatar(multiPadding, rightProps.style)} size={multiSize} />
      </Box>
    )
  }
}

const rightStyle = memoize((style, backgroundColor) => ({
  ...style,
  backgroundColor,
}))

const singleStyle = {
  ...globalStyles.flexBoxCenter,
  height: '100%',
  width: '100%',
}

const leftAvatar = memoize((offset = 0, style) => ({
  left: 0,
  position: 'absolute',
  top: offset,
  ...style,
}))

const rightAvatar = memoize((offset = 0, style) => ({
  bottom: offset,
  position: 'absolute',
  right: 0,
  ...style,
}))

export default MultiAvatar
