// @flow
import React from 'react'
import {Avatar, Box} from '../../../common-adapters'
import {globalStyles, globalMargins} from '../../../styles'

export type Props = {
  bgColor: string,
  username: string,
  children?: React$Element<*>,
  style?: ?Object,
}

const AVATAR_SIZE = 24

const UserNotice = ({bgColor, username, children, style}: Props) =>
  <Box style={{...styleBox, ...style, backgroundColor: bgColor}}>
    <Avatar
      size={AVATAR_SIZE}
      username={username}
      style={{marginTop: -globalMargins.small - AVATAR_SIZE / 2, marginBottom: globalMargins.xtiny}}
    />
    {children}
  </Box>

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
