import type * as React from 'react'
import * as Styles from '@/styles'
import * as C from '@/constants'
import Avatar from './avatar'
import {Box2} from './box'
import ClickableBox from './clickable-box'
import IconAuto from './icon-auto'
import type {IconType} from './icon.constants-gen'
import Icon from './icon'
import ImageIcon from './image-icon'
import Text from './text'
import type {TextType, StylesTextCrossPlatform, AllowedColors, TextTypeBold} from './text.shared'
import ConnectedUsernames from './usernames'
import {useFollowerState} from '@/stores/followers'
import {navToProfile} from '@/constants/router'
import {useTeamsListNameToIDMap} from '@/teams/use-teams-list'

type AvatarSize = 128 | 96 | 64 | 48 | 32 | 24 | 16

type Size = 'smaller' | 'small' | 'default' | 'big' | 'huge'

const followSizeToStyle128 = {bottom: 0, left: 88, position: 'absolute'} as const
const followSizeToStyle96 = {bottom: 0, left: 65, position: 'absolute'} as const
const followSizeToStyle64 = {bottom: 0, left: 44, position: 'absolute'} as const
const followSizeToStyle48 = {bottom: 0, left: 30, position: 'absolute'} as const

// Exposed style props for the top-level container and box around metadata arbitrarily
export type NameWithIconProps = {
  avatarImageOverride?: string
  avatarSize?: AvatarSize
  avatarStyle?: Styles.StylesCrossPlatform
  botAlias?: string | React.ReactNode
  colorBroken?: boolean
  colorFollowing?: boolean
  notFollowingColorOverride?: AllowedColors
  containerStyle?: Styles.StylesCrossPlatform
  editableIcon?: boolean
  hideFollowingOverlay?: boolean
  horizontal?: boolean
  icon?: IconType
  iconBoxStyle?: Styles.StylesCrossPlatform
  isYou?: boolean
  metaOne?: string | React.ReactNode
  metaStyle?: Styles.StylesCrossPlatform
  metaTwo?: string | React.ReactElement // If components such as metaOne or
  // metaTwo are passed in to NameWithIcon with click handlers and NameWithIcon has its own onClick handler,
  // both will fire unless the inner clicks call `event.preventDefault()`
  onClick?: (username: string) => void
  clickType?: 'profile' | 'onClick'
  onEditIcon?: (e?: React.BaseSyntheticEvent) => void
  selectable?: boolean
  size?: Size
  teamname?: string
  channelname?: string
  // for non-users
  title?: string | React.ReactNode
  titleStyle?: StylesTextCrossPlatform
  underline?: boolean
  username?: string
  withProfileCardPopup?: boolean
}

// If lineclamping isn't working, try adding a static width in containerStyle
const NameWithIcon = (props: NameWithIconProps) => {
  const {onClick, username = '', teamname, size} = props
  const _onClickWrapper = onClick
    ? (event: React.BaseSyntheticEvent) => {
        if (!event.defaultPrevented) {
          username && onClick(username)
        }
      }
    : undefined

  if (username && teamname) {
    throw new Error('Can only use username or teamname in NameWithIcon; got both')
  }

  const isAvatar = !!(username || teamname) && !props.icon
  const commonHeight = size === 'big' ? 64 : Styles.isMobile ? 48 : 32
  const adapterProps = getAdapterProps(size || 'default')

  const showFollowing = !props.horizontal && !props.hideFollowingOverlay && !!username
  const following = useFollowerState(s => (showFollowing && username ? s.following.has(username) : false))
  const followsYou = useFollowerState(s => (showFollowing && username ? s.followers.has(username) : false))
  const avatarSize: AvatarSize = props.avatarSize || (props.horizontal ? commonHeight : adapterProps.iconSize)
  const followIconType = showFollowing
    ? followsYou === following
      ? (followsYou ? ('icon-mutual-follow-21' as const) : undefined)
      : followsYou ? ('icon-follow-me-21' as const) : ('icon-following-21' as const)
    : undefined
  const followIconStyle = avatarSize === 128
    ? followSizeToStyle128
    : avatarSize === 96
      ? followSizeToStyle96
      : avatarSize === 64
        ? followSizeToStyle64
        : avatarSize === 48
          ? followSizeToStyle48
          : undefined

  let avatarOrIcon: React.ReactNode
  if (isAvatar) {
    avatarOrIcon = (
      <Avatar
        imageOverrideUrl={props.avatarImageOverride}
        size={avatarSize}
        username={username}
        teamname={teamname}
        onClick={props.editableIcon ? props.onEditIcon : undefined}
        style={Styles.collapseStyles([
          props.horizontal ? styles.hAvatarStyle : {},
          props.horizontal && size === 'big' ? styles.hbAvatarStyle : {},
          props.avatarStyle,
        ])}
      >
        {!!followIconType && !!followIconStyle && <ImageIcon type={followIconType} style={followIconStyle} />}
        {!!props.editableIcon && (
          <Icon
            type="iconfont-edit"
            style={teamname ? styles.editTeam : styles.editUser}
          />
        )}
      </Avatar>
    )
  } else if (props.icon) {
    avatarOrIcon = (
      <Box2 direction="vertical" style={props.iconBoxStyle}>
        <IconAuto
          type={props.icon}
          style={
            props.horizontal
              ? size === 'big'
                ? styles.hbIconStyle
                : styles.hIconStyle
              : {height: adapterProps.iconSize, width: adapterProps.iconSize}
          }
          fontSize={props.horizontal ? (Styles.isMobile ? 48 : 32) : adapterProps.iconSize}
        />
      </Box2>
    )
  }
  const usernames = [username]
  const title = props.title || ''
  const usernameOrTitle = title ? (
    <TextOrComponent
      textType={props.horizontal ? 'BodySemibold' : adapterProps.titleType}
      style={props.horizontal ? undefined : props.titleStyle}
      val={props.title || ''}
    />
  ) : (
    <ConnectedUsernames
      onUsernameClicked={props.clickType === 'onClick' ? onClick : 'profile'}
      type={props.horizontal ? 'BodyBold' : adapterProps.titleType}
      containerStyle={Styles.collapseStyles([
        !props.horizontal && !Styles.isMobile && styles.vUsernameContainerStyle,
        size === 'smaller' && styles.smallerWidthTextContainer,
      ] as const)}
      inline={!props.horizontal}
      underline={props.underline}
      selectable={props.selectable}
      usernames={usernames}
      colorBroken={props.colorBroken}
      colorFollowing={props.colorFollowing}
      colorYou={props.notFollowingColorOverride || true}
      notFollowingColorOverride={props.notFollowingColorOverride}
      style={size === 'smaller' ? undefined : (styles.fullWidthText as StylesTextCrossPlatform)}
      withProfileCardPopup={props.withProfileCardPopup}
    />
  )
  const metaOne = (
    <TextOrComponent
      textType={props.horizontal ? 'BodySmall' : adapterProps.metaOneType}
      val={props.metaOne}
      style={props.horizontal ? undefined : (styles.fullWidthText as StylesTextCrossPlatform)}
    />
  )
  const metaTwo = (
    <TextOrComponent
      textType="BodySmall"
      val={props.metaTwo}
      style={props.horizontal ? undefined : (styles.fullWidthText as StylesTextCrossPlatform)}
    />
  )
  const botAlias = (
    <TextOrComponent
      textType="Header"
      val={props.botAlias}
      style={props.horizontal ? styles.botAlias : (styles.fullWidthText as StylesTextCrossPlatform)}
    />
  )
  const metas = props.horizontal ? (
    <Box2 direction="horizontal" fullWidth={true} style={styles.metasBox}>
      {metaOne}
      {!!(props.metaTwo && props.metaOne) && <Text type="BodySmall">&nbsp;·&nbsp;</Text>}
      {metaTwo}
    </Box2>
  ) : (
    <>
      {metaOne}
      {metaTwo}
    </>
  )

  const containerStyle = Styles.collapseStyles([
    props.horizontal
      ? size === 'big'
        ? styles.hbContainerStyle
        : styles.hContainerStyle
      : styles.vContainerStyle,
    props.containerStyle,
  ])

  const metaContainerStyle = props.horizontal
    ? Styles.collapseStyles([size === 'big' && styles.textContainer, props.metaStyle])
    : Styles.collapseStyles([
        styles.metaStyle,
        size === 'smaller' && styles.smallerWidthTextContainer,
        size !== 'smaller' && styles.fullWidthTextContainer,
        {marginTop: adapterProps.metaMargin},
        props.metaStyle,
        size === 'smaller' ? styles.smallerWidthTextContainer : {},
      ] as const)

  const children = (
    <>
      {avatarOrIcon}
      <Box2 direction="vertical" centerChildren={!props.horizontal} style={metaContainerStyle}>
        {botAlias}
        {usernameOrTitle}
        {metas}
      </Box2>
    </>
  )

  return _onClickWrapper ? (
    <ClickableBox onClick={_onClickWrapper} style={containerStyle}>
      {children}
    </ClickableBox>
  ) : (
    <Box2
      direction={props.horizontal ? 'horizontal' : 'vertical'}
      alignItems="center"
      style={containerStyle}
    >
      {children}
    </Box2>
  )
}

// Render text if it's text, or identity if otherwise
const TextOrComponent = (props: {
  val: string | React.ReactNode
  textType: TextType
  style?: StylesTextCrossPlatform
}): React.ReactNode => {
  if (typeof props.val === 'string') {
    return (
      <Text style={props.style} lineClamp={1} type={props.textType}>
        {props.val}
      </Text>
    )
  }
  return props.val
}

const styles = Styles.styleSheetCreate(() => ({
  botAlias: {
    paddingTop: Styles.globalMargins.xtiny,
  },
  editTeam: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blue,
      borderColor: Styles.globalColors.white,
      borderRadius: 100,
      borderStyle: 'solid',
      borderWidth: 2,
      bottom: -6,
      color: Styles.globalColors.whiteOrWhite,
      padding: 4,
      position: 'absolute',
      right: -6,
    },
  }),
  editUser: {
    bottom: 0,
    position: 'absolute',
    right: 0,
  },
  fullWidthText: Styles.platformStyles({
    isElectron: {display: 'unset', whiteSpace: 'nowrap', width: '100%', wordBreak: 'break-all'},
  }),
  fullWidthTextContainer: Styles.platformStyles({isElectron: {textAlign: 'center', width: '100%'}}),
  hAvatarStyle: Styles.platformStyles({
    isElectron: {marginRight: Styles.globalMargins.tiny},
    isMobile: {
      marginRight: Styles.globalMargins.small,
    },
  }),
  hContainerStyle: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center' as const,
  },
  hIconStyle: Styles.platformStyles({
    isElectron: {
      height: 32,
      marginRight: Styles.globalMargins.tiny,
      width: 32,
    },
    isMobile: {
      height: 48,
      marginRight: Styles.globalMargins.small,
      width: 48,
    },
  }),
  hbAvatarStyle: {
    height: 64,
    marginRight: Styles.globalMargins.small,
    width: 64,
  },
  hbContainerStyle: {
    ...Styles.globalStyles.flexBoxRow,
    width: '100%',
  },
  hbIconStyle: Styles.platformStyles({
    common: {marginRight: Styles.globalMargins.small},
    isElectron: {
      height: 48,
      width: 48,
    },
    isMobile: {
      height: 64,
      width: 64,
    },
  }),
  metaStyle: {
    marginTop: Styles.globalMargins.tiny,
  },
  metasBox: {
    maxWidth: '100%',
  },
  smallerWidthTextContainer: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.black_50,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      width: 48,
    },
  }),
  textContainer: {
    flex: 1,
  },
  vContainerStyle: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center' as const,
  },
  vUsernameContainerStyle: Styles.platformStyles({
    isElectron: {
      textAlign: 'center',
    },
  }),
}))

// Get props to pass to subcomponents (Text, Avatar, etc.)
const getAdapterProps = (
  size: Size
): {
  iconSize: 16 | 24 | 32 | 64 | 48 | 128 | 96
  metaMargin: number
  metaOneType: TextType
  titleType: TextTypeBold
} => {
  switch (size) {
    case 'smaller':
      return {
        iconSize: 48,
        metaMargin: 6,
        metaOneType: 'BodySmall',
        titleType: 'BodyTinyBold',
      }
    case 'small':
      return {
        iconSize: 48,
        metaMargin: Styles.globalMargins.tiny,
        metaOneType: 'BodySmall',
        titleType: 'BodyBold',
      }
    case 'big':
      return {
        iconSize: 96,
        metaMargin: Styles.globalMargins.tiny,
        metaOneType: 'BodySemibold',
        titleType: 'HeaderBig',
      }
    case 'huge':
      return {
        iconSize: 128,
        metaMargin: Styles.globalMargins.tiny,
        metaOneType: 'BodySemibold',
        titleType: 'HeaderBig',
      }
    default:
      return {
        iconSize: 64,
        metaMargin: Styles.globalMargins.tiny,
        metaOneType: 'BodySemibold',
        titleType: 'BodyBold',
      }
  }
}

export type ConnectedNameWithIconProps = {
  onClick?: 'profile' | NameWithIconProps['onClick']
} & Omit<NameWithIconProps, 'onClick'>

type OwnProps = ConnectedNameWithIconProps

const ConnectedUserNameWithIcon = (p: OwnProps & {username: string}) => {
  const {onClick, username, teamname, ...props} = p
  const onOpenUserProfile = () => {
    navToProfile(username)
  }

  let functionOnClick: NameWithIconProps['onClick']
  let clickType: NameWithIconProps['clickType'] = 'onClick'
  switch (onClick) {
    case 'profile':
      functionOnClick = onOpenUserProfile
      clickType = 'profile'
      break
    default:
      functionOnClick = onClick
  }

  return (
    <NameWithIcon
      {...props}
      clickType={clickType}
      onClick={functionOnClick}
      teamname={teamname}
      username={username}
    />
  )
}

const ConnectedTeamNameWithIcon = (p: OwnProps & {teamname: string}) => {
  const {onClick, username, teamname, ...props} = p
  const teamNameToID = useTeamsListNameToIDMap()
  const teamID = teamNameToID.get(teamname)
  const clearModals = C.Router2.clearModals
  const navigateAppend = C.Router2.navigateAppend
  const onOpenTeamProfile = () => {
    if (teamID) {
      clearModals()
      navigateAppend({name: 'team', params: {teamID}})
    }
  }

  let functionOnClick: NameWithIconProps['onClick']
  let clickType: NameWithIconProps['clickType'] = 'onClick'
  switch (onClick) {
    case 'profile': {
      if (teamID) {
        functionOnClick = onOpenTeamProfile
      }
      clickType = 'profile'
      break
    }
    default:
      functionOnClick = onClick
  }

  return (
    <NameWithIcon
      {...props}
      clickType={clickType}
      onClick={functionOnClick}
      teamname={teamname}
      username={username}
    />
  )
}

const ConnectedNameWithIcon = (p: OwnProps) =>
  p.username ? (
    <ConnectedUserNameWithIcon {...p} username={p.username} />
  ) : p.teamname ? (
    <ConnectedTeamNameWithIcon {...p} teamname={p.teamname} />
  ) : (
    <NameWithIcon {...p} onClick={typeof p.onClick === 'function' ? p.onClick : undefined} />
  )

export default ConnectedNameWithIcon
