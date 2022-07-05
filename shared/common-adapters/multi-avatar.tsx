// Simple control to show multiple avatars. Just used in chat but could be expanded. Keeping this simple for now
import shallowEqual from 'shallowequal'
import logger from '../logger'
import Avatar, {OwnProps as AvatarProps, AvatarSize} from './avatar'
import Box from './box'
import * as React from 'react'
import * as Styles from '../styles'

const Kb = {
  Avatar,
  Box,
}

export type Props = {
  avatarProps: Array<AvatarProps>
  singleSize: AvatarSize
  multiSize: AvatarSize
  style?: Styles.StylesCrossPlatform
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
      <Kb.Box style={Styles.collapseStyles([{position: 'relative', width: '100%'}, style])}>
        <Kb.Avatar {...leftProps} style={leftAvatar(multiPadding, leftProps.style)} size={multiSize} />
        <Kb.Avatar {...rightProps} style={rightAvatar(multiPadding, rightProps.style)} size={multiSize} />
      </Kb.Box>
    )
  }
}

const singleStyle = {
  ...Styles.globalStyles.flexBoxCenter,
  width: '100%',
}

const leftAvatar = (offset: number = 0, style: Styles.StylesCrossPlatform) =>
  Styles.collapseStyles([
    {
      left: 0,
      position: 'absolute',
      top: offset,
    },
    style,
  ])

const rightAvatar = (offset: number = 0, style: Styles.StylesCrossPlatform) =>
  Styles.collapseStyles([
    {
      bottom: offset,
      position: 'absolute',
      right: 0,
    },
    style,
  ])

export default MultiAvatar
