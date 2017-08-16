// @flow
// Simple control to show multiple avatars. Just used in chat but could be expanded. Keeping this simple for now
import Avatar from './avatar'
import Box from './box'
import React, {Component} from 'react'
import {globalStyles} from '../styles'

import type {Props as AvatarProps, AvatarSize} from './avatar'

export type Props = {
  avatarProps: Array<AvatarProps>,
  singleSize: AvatarSize,
  multiSize: AvatarSize,
  style?: ?Object,
  multiPadding?: number,
}

class MultiAvatar extends Component<void, Props, void> {
  shouldComponentUpdate(nextProps: Props, nextState: any): boolean {
    return JSON.stringify(this.props) !== JSON.stringify(nextProps)
  }

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

    const backgroundColor = (this.props.style &&
    this.props.style.backgroundColor && {backgroundColor: this.props.style.backgroundColor}) || {}
    if (avatarProps.length === 1) {
      return (
        <Box style={singleStyle}>
          <Avatar style={{...backgroundColor, ...rightProps.style}} {...rightProps} size={singleSize} />
        </Box>
      )
    }

    return (
      <Box style={{height: '100%', position: 'relative', width: '100%', ...style}}>
        <Avatar {...leftProps} style={{...leftAvatar(multiPadding), ...leftProps.style}} size={multiSize} />
        <Avatar
          {...rightProps}
          style={{...rightAvatar(multiPadding), ...rightProps.style}}
          size={multiSize}
        />
      </Box>
    )
  }
}

const singleStyle = {
  ...globalStyles.flexBoxCenter,
  height: '100%',
  width: '100%',
}

const leftAvatar = (offset = 0) => ({
  left: 0,
  position: 'absolute',
  top: offset,
})

const rightAvatar = (offset = 0) => ({
  bottom: offset,
  position: 'absolute',
  right: 0,
})

export default MultiAvatar
