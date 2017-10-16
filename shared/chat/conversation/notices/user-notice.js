// @flow
import * as React from 'react'
import {Avatar, Box} from '../../../common-adapters'
import {isMobile} from '../../../constants/platform'
import {globalStyles, globalMargins} from '../../../styles'

export type Props = {
  bgColor: string,
  username: string,
  children?: React.Node,
  style?: ?Object,
}

const AVATAR_SIZE = 24

const UserNotice = ({bgColor, username, children, style}: Props) => (
  <Box style={{...styleBox, ...style, backgroundColor: bgColor}}>
    <Avatar size={AVATAR_SIZE} username={username} style={styleAvatar} />
    {children}
  </Box>
)

const styleAvatar = {
  marginBottom: !isMobile ? globalMargins.xtiny : 0,
  marginTop: isMobile ? -globalMargins.tiny - AVATAR_SIZE / 4 : -globalMargins.small - AVATAR_SIZE / 2,
}

const styleBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  marginTop: AVATAR_SIZE / 2,
  marginLeft: globalMargins.xlarge,
  marginRight: globalMargins.xlarge,
  marginBottom: globalMargins.medium,
  padding: globalMargins.small,
  paddingBottom: globalMargins.tiny,
  borderRadius: globalMargins.xtiny,
}

export default UserNotice
