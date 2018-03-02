// @flow
import * as React from 'react'
import Avatar, {type AvatarSize} from './avatar'
import Box from './box'
import Icon from './icon'
import {type IconType} from './icon.constants'
import Text from './text'
import {globalStyles, isMobile} from '../styles'

type Size = 'small' | 'default' | 'large'

const sizeToIconSize: {[key: Size]: number} = {
  small: 48,
  default: 64,
  large: 64,
}
const sizeToUserAvatarSize: {[key: Size]: number} = {
  small: 64,
  default: 80,
  large: 112,
}

export type Props = {
  following?: boolean,
  followsMe?: boolean,
  horizontal?: boolean,
  icon?: IconType,
  metaOne?: string | React.Node,
  metaTwo?: string | React.Node,
  onClick?: () => void,
  size: AvatarSize,
  containerStyle?: any,
  metaStyle?: any,
  iconStyle?: any,
  teamname?: string,
  username?: string,
}

const NameWithIcon = (props: Props) => {
  if (props.username && props.teamname) {
    throw new Error('Can only use username or teamname in NameWithIcon')
  }
  return (
    <Box style={{...containerStyle, ...props.containerStyle}}>
      <Avatar
        size={props.size}
        following={props.following}
        followsYou={props.followsMe}
        username={props.username}
        teamname={props.teamname}
      />
      <Box style={{...metaStyle, ...props.metaStyle}}>
        {props.metaOne && <Text type="Header">{props.metaOne}</Text>}
        {props.metaTwo && <Text type="BodySmall">{props.metaTwo}</Text>}
      </Box>
    </Box>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexBoxCenter,
  padding: 24,
}

const metaStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexBoxCenter,
  marginTop: 8,
}

export default NameWithIcon
