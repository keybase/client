// Simple control to show multiple avatars. Just used in chat but could be expanded. Keeping this simple for now
import shallowEqual from 'shallowequal'
import logger from '../logger'
import Avatar, {OwnProps as AvatarProps, AvatarSize} from './avatar'
import Box from './box'
import * as React from 'react'
import {globalStyles, StylesCrossPlatform, collapseStyles} from '../styles'

export type Props = {
  avatarProps: Array<AvatarProps>
  singleSize: AvatarSize
  multiSize: AvatarSize
  style?: StylesCrossPlatform
  multiPadding?: number
}

class MultiAvatar extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (_, __, key) => {
      if (key === 'avatarProps') {
        return shallowEqual(this.props.avatarProps, nextProps.avatarProps)
      }

      return undefined
    })
  }
  render() {
    const {avatarProps, singleSize, multiSize, style, multiPadding} = this.props
    if (avatarProps.length <= 0) {
      return null
    }
    if (avatarProps.length > 2) {
      logger.warn('MultiAvatar only handles up to 2 avatars')
      return null
    }

    const leftProps: AvatarProps = avatarProps[1]
    const rightProps: AvatarProps = avatarProps[0]

    if (avatarProps.length === 1) {
      return (
        <Box style={singleStyle}>
          <Avatar {...rightProps} size={singleSize} />
        </Box>
      )
    }

    return (
      <Box style={collapseStyles([{height: '100%', position: 'relative', width: '100%'}, style])}>
        <Avatar {...leftProps} style={leftAvatar(multiPadding, leftProps.style)} size={multiSize} />
        <Avatar {...rightProps} style={rightAvatar(multiPadding, rightProps.style)} size={multiSize} />
      </Box>
    )
  }
}

const singleStyle = {
  ...globalStyles.flexBoxCenter,
  height: '100%',
  width: '100%',
}

const leftAvatar = (offset = 0, style) =>
  collapseStyles([
    {
      left: 0,
      position: 'absolute',
      top: offset,
    },
    style,
  ])

const rightAvatar = (offset = 0, style) =>
  collapseStyles([
    {
      bottom: offset,
      position: 'absolute',
      right: 0,
    },
    style,
  ])

export default MultiAvatar
