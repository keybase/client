// @flow
// Simple control to show multiple avatars. Just used in chat but could be expanded. Keeping this simple for now
import shallowEqual from 'shallowequal'
import logger from '../logger'
import Avatar from './avatar'
import Box from './box'
import * as React from 'react'
import {globalStyles, type StylesCrossPlatform} from '../styles'
import {createSelector} from 'reselect'

import type {Props as AvatarProps, AvatarSize} from './avatar'

export type Props = {
  avatarProps: Array<AvatarProps>,
  singleSize: AvatarSize,
  multiSize: AvatarSize,
  style?: StylesCrossPlatform,
  multiPadding?: number,
}

class MultiAvatar extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
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

    // $FlowIssue making unsafe assumptions about style being an object, TODO fix this
    const backgroundColor = this.props.style && this.props.style.backgroundColor
    if (avatarProps.length === 1) {
      return (
        <Box style={singleStyle}>
          <Avatar style={rightStyle(rightProps.style, backgroundColor)} {...rightProps} size={singleSize} />
        </Box>
      )
    }

    return (
      // $FlowIssue making unsafe assumptions about style being an object, TODO fix this
      <Box style={{height: '100%', position: 'relative', width: '100%', ...style}}>
        <Avatar {...leftProps} style={leftAvatar(multiPadding, leftProps.style)} size={multiSize} />
        <Avatar {...rightProps} style={rightAvatar(multiPadding, rightProps.style)} size={multiSize} />
      </Box>
    )
  }
}

// $FlowIssue making unsafe assumptions about style being an object, TODO fix this
const rightStyle = createSelector([a => a, (_, b) => b], (style: ?Object, backgroundColor: ?string) => ({
  ...(style || {}),
  backgroundColor,
}))

const singleStyle = {
  ...globalStyles.flexBoxCenter,
  height: '100%',
  width: '100%',
}

// $FlowIssue making unsafe assumptions about style being an object, TODO fix this
const leftAvatar = createSelector([a => a, (_, b) => b], (offset = 0, style) => ({
  // $FlowIssue making unsafe assumptions about style being an object, TODO fix this
  left: 0,
  position: 'absolute',
  top: offset,
  ...(style || {}),
}))

// $FlowIssue making unsafe assumptions about style being an object, TODO fix this
const rightAvatar = createSelector([a => a, (_, b) => b], (offset = 0, style) => ({
  bottom: offset,
  position: 'absolute',
  // $FlowIssue making unsafe assumptions about style being an object, TODO fix this
  right: 0,
  ...(style || {}),
}))

export default MultiAvatar
