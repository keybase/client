import * as React from 'react'
import {Avatar, Box, ClickableBox} from '../../../common-adapters'
import {globalStyles, globalMargins, isMobile, desktopStyles, platformStyles} from '../../../styles'

export type Props = {
  bgColor: string
  username?: string
  teamname?: string
  children?: React.ReactNode
  style?: Object | null
  onClickAvatar?: () => void
}

const AVATAR_SIZE = 32

const UserNotice = ({bgColor, username, teamname, children, style, onClickAvatar}: Props) => (
  <Box style={{...styleOuterBox, ...style}}>
    {!!(username || teamname) && (
      <ClickableBox style={stylesAvatarWrapper(AVATAR_SIZE)} onClick={onClickAvatar}>
        <Avatar size={AVATAR_SIZE} {...(username ? {username} : {teamname})} style={stylesAvatar} />
      </ClickableBox>
    )}
    <Box style={{...styleBox, backgroundColor: bgColor}}>{children}</Box>
  </Box>
)

export type SmallProps = {
  avatarUsername: string
  bottomLine: React.ElementType
  onAvatarClicked: () => void
  title?: string
  topLine: React.ElementType
}

const SmallUserNotice = (props: SmallProps) => (
  <Box style={styleSmallNotice} title={props.title}>
    <Avatar
      onClick={props.onAvatarClicked}
      size={32}
      username={props.avatarUsername}
      style={{marginRight: globalMargins.tiny}}
    />
    <Box style={globalStyles.flexBoxColumn}>
      {props.topLine}
      {props.bottomLine}
    </Box>
  </Box>
)
const styleSmallNotice = platformStyles({
  common: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'flex-start',
    marginBottom: globalMargins.xtiny,
    ...globalStyles.flexBoxRow,
    marginRight: globalMargins.medium,
    marginTop: globalMargins.xtiny,
  },
  isElectron: {
    marginLeft: globalMargins.small,
  },
  isMobile: {
    marginLeft: globalMargins.tiny,
  },
})

const styleOuterBox = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  marginBottom: globalMargins.tiny,
}

const stylesAvatarWrapper = (avatarSize: number) =>
  ({
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: avatarSize,
    position: 'relative',
    top: AVATAR_SIZE / 2,
    zIndex: 10,
  } as const)
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
