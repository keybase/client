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

export type SmallProps = {
  avatarUsername: string,
  bottomLine: React.Node,
  onAvatarClicked: () => void,
  title?: string,
  topLine: React.Node,
}

const SmallUserNotice = (props: SmallProps) => (
  <Box
    style={{
      flex: 1,
      marginTop: 3,
      marginBottom: 3,
      marginLeft: globalMargins.tiny,
      marginRight: globalMargins.medium,
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      justifyContent: 'flex-start',
    }}
    title={props.title}
  >
    <Avatar
      onClick={props.onAvatarClicked}
      size={24}
      username={props.avatarUsername}
      style={{marginRight: globalMargins.tiny}}
    />
    <Box style={globalStyles.flexBoxColumn}>
      {props.topLine}
      {props.bottomLine}
    </Box>
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

export {SmallUserNotice}
export default UserNotice
