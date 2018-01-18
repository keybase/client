// @flow
import * as React from 'react'
import {Avatar, Box} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'

export type Props = {
  bgColor: string,
  username?: string,
  teamname?: string,
  children?: React.Node,
  style?: ?Object,
}

const AVATAR_SIZE = 24

const UserNotice = ({bgColor, username, teamname, children, style}: Props) => (
  <Box style={{...styleOuterBox, ...style}}>
    {(username || teamname) && (
      <Box style={stylesAvatarWrapper(AVATAR_SIZE)}>
        <Avatar size={AVATAR_SIZE} {...(username ? {username} : {teamname})} style={stylesAvatar} />
      </Box>
    )}
    <Box style={{...styleBox, backgroundColor: bgColor}}>{children}</Box>
  </Box>
)

const styleOuterBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const stylesAvatarWrapper = (avatarSize: number) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: avatarSize,
  position: 'relative',
  top: AVATAR_SIZE / 2,
  zIndex: 10,
})
const stylesAvatar = {
  ...globalStyles.clickable,
}

const styleBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  marginLeft: globalMargins.medium,
  marginRight: globalMargins.medium,
  padding: globalMargins.small,
  paddingBottom: globalMargins.tiny,
  borderRadius: globalMargins.xtiny,
  alignSelf: 'stretch',
}

export default UserNotice
