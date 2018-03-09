// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile, desktopStyles, platformStyles} from '../../../styles'

export type Props = {
  bgColor: string,
  username?: string,
  teamname?: string,
  children?: React.Node,
  style?: ?Object,
  onClickAvatar?: () => void,
}

const AVATAR_SIZE = isMobile ? 32 : 24

const UserNotice = ({bgColor, username, teamname, children, style, onClickAvatar}: Props) => (
  <Box style={{...styleOuterBox, ...style}}>
    {(username || teamname) && (
      <ClickableBox style={stylesAvatarWrapper(AVATAR_SIZE)} onClick={onClickAvatar}>
        <Avatar size={AVATAR_SIZE} {...(username ? {username} : {teamname})} style={stylesAvatar} />
      </ClickableBox>
    )}
    <Box style={{...styleBox, backgroundColor: bgColor}}>{children}</Box>
  </Box>
)

const styleOuterBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  marginBottom: globalMargins.tiny,
}

const stylesAvatarWrapper = (avatarSize: number) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: avatarSize,
  position: 'relative',
  top: AVATAR_SIZE / 2,
  zIndex: 10,
})
const stylesAvatar = platformStyles({
  isElectron: {
    ...desktopStyles.clickable,
  },
})

const styleBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  borderRadius: globalMargins.xtiny,
  marginLeft: isMobile ? globalMargins.medium : globalMargins.xlarge,
  marginRight: isMobile ? globalMargins.medium : globalMargins.xlarge,
  padding: globalMargins.small,
  paddingBottom: globalMargins.tiny,
}

export default UserNotice
