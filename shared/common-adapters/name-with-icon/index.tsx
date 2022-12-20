import * as React from 'react'
import * as Styles from '../../styles'
import Avatar, {type AvatarSize} from '../avatar'
import {Box} from '../box'
import ClickableBox from '../clickable-box'
import Icon, {type IconType} from '../icon'
import Text, {
  type TextType,
  type StylesTextCrossPlatform,
  type AllowedColors,
  type TextTypeBold,
} from '../text'
import ConnectedUsernames from '../usernames'

type Size = 'smaller' | 'small' | 'default' | 'big' | 'huge'

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
  const _onClickWrapper = (event: React.SyntheticEvent) => {
    if (!event.defaultPrevented && props.onClick) {
      props.username && props.onClick(props.username)
    }
  }

  if (props.username && props.teamname) {
    throw new Error('Can only use username or teamname in NameWithIcon; got both')
  }

  const isAvatar = !!(props.username || props.teamname) && !props.icon
  const commonHeight = props.size === 'big' ? 64 : Styles.isMobile ? 48 : 32
  const BoxComponent = props.onClick ? ClickableBox : Box
  const adapterProps = getAdapterProps(props.size || 'default')

  let avatarOrIcon
  if (isAvatar) {
    avatarOrIcon = (
      <Avatar
        imageOverrideUrl={props.avatarImageOverride}
        editable={props.editableIcon}
        onEditAvatarClick={props.editableIcon ? props.onEditIcon : undefined}
        size={props.avatarSize || (props.horizontal ? commonHeight : (adapterProps.iconSize as any))}
        showFollowingStatus={props.horizontal ? undefined : !props.hideFollowingOverlay}
        username={props.username}
        teamname={props.teamname}
        style={Styles.collapseStyles([
          props.horizontal ? styles.hAvatarStyle : {},
          props.horizontal && props.size === 'big' ? styles.hbAvatarStyle : {},
          props.avatarStyle,
        ])}
      />
    )
  } else if (props.icon) {
    avatarOrIcon = (
      <Icon
        boxStyle={props.iconBoxStyle}
        type={props.icon}
        style={
          props.horizontal
            ? props.size === 'big'
              ? styles.hbIconStyle
              : styles.hIconStyle
            : {height: adapterProps.iconSize, width: adapterProps.iconSize}
        }
        fontSize={props.horizontal ? (Styles.isMobile ? 48 : 32) : adapterProps.iconSize}
      />
    )
  }
  const username = props.username || ''
  const usernames = React.useMemo(() => [username], [username])
  const title = props.title || ''
  const usernameOrTitle = title ? (
    <TextOrComponent
      textType={props.horizontal ? 'BodySemibold' : adapterProps.titleType}
      style={props.horizontal ? undefined : props.titleStyle}
      val={props.title || ''}
    />
  ) : (
    <ConnectedUsernames
      onUsernameClicked={props.clickType === 'onClick' ? props.onClick : 'profile'}
      type={props.horizontal ? 'BodyBold' : adapterProps.titleType}
      containerStyle={Styles.collapseStyles([
        !props.horizontal && !Styles.isMobile && styles.vUsernameContainerStyle,
        props.size === 'smaller' && styles.smallerWidthTextContainer,
      ] as const)}
      inline={!props.horizontal}
      underline={props.underline}
      selectable={props.selectable}
      usernames={usernames}
      colorBroken={props.colorBroken}
      colorFollowing={props.colorFollowing}
      colorYou={props.notFollowingColorOverride || true}
      notFollowingColorOverride={props.notFollowingColorOverride}
      style={props.size === 'smaller' ? {} : (styles.fullWidthText as any)}
      withProfileCardPopup={props.withProfileCardPopup}
    />
  )
  const metaOne = (
    <TextOrComponent
      textType={props.horizontal ? 'BodySmall' : adapterProps.metaOneType}
      val={props.metaOne || null}
      style={props.horizontal ? undefined : (styles.fullWidthText as any)}
    />
  )
  const metaTwo = (
    <TextOrComponent
      textType="BodySmall"
      val={props.metaTwo || null}
      style={props.horizontal ? undefined : (styles.fullWidthText as any)}
    />
  )
  const botAlias = (
    <TextOrComponent
      textType="Header"
      val={props.botAlias || null}
      style={props.horizontal ? styles.botAlias : (styles.fullWidthText as any)}
    />
  )
  const metas = props.horizontal ? (
    <Box style={styles.metasBox}>
      {metaOne}
      {!!(props.metaTwo && props.metaOne) && <Text type="BodySmall">&nbsp;·&nbsp;</Text>}
      {metaTwo}
    </Box>
  ) : (
    <>
      {metaOne}
      {metaTwo}
    </>
  )

  return (
    <BoxComponent
      // @ts-ignore TODO fix
      onClick={props.onClick ? _onClickWrapper : undefined}
      style={Styles.collapseStyles([
        props.horizontal
          ? props.size === 'big'
            ? styles.hbContainerStyle
            : styles.hContainerStyle
          : styles.vContainerStyle,
        props.containerStyle,
      ])}
    >
      {avatarOrIcon}
      <Box
        style={
          props.horizontal
            ? Styles.collapseStyles([
                Styles.globalStyles.flexBoxColumn,
                props.size === 'big' && styles.textContainer,
                props.metaStyle,
              ])
            : Styles.collapseStyles([
                Styles.globalStyles.flexBoxRow,
                styles.metaStyle,
                props.size === 'smaller' && styles.smallerWidthTextContainer,
                props.size !== 'smaller' && styles.fullWidthTextContainer,
                {marginTop: adapterProps.metaMargin},
                props.metaStyle,
                props.size === 'smaller' ? styles.smallerWidthTextContainer : {},
              ] as const)
        }
      >
        {botAlias}
        {usernameOrTitle}
        {metas}
      </Box>
    </BoxComponent>
  )
}

// Render text if it's text, or identity if otherwise
const TextOrComponent = (props: {
  val: string | React.ReactNode
  textType: TextType
  style?: StylesTextCrossPlatform
}): React.ReactElement => {
  if (typeof props.val === 'string') {
    return (
      <Text style={props.style} lineClamp={1} type={props.textType}>
        {props.val}
      </Text>
    )
  }
  // @ts-ignore to fix wrap in fragment
  return props.val
}

const styles = Styles.styleSheetCreate(() => ({
  botAlias: {
    paddingTop: Styles.globalMargins.xtiny,
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
    alignItems: 'center',
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
      backgroundColor: Styles.globalColors.fastBlank,
      height: 64,
      width: 64,
    },
  }),
  metaStyle: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.flexBoxCenter,
    marginTop: Styles.globalMargins.tiny,
  },
  metasBox: {
    ...Styles.globalStyles.flexBoxRow,
    maxWidth: '100%',
    width: '100%',
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
    alignItems: 'center',
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
): {iconSize: number; metaMargin: number; metaOneType: TextType; titleType: TextTypeBold} => {
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
  }
  // default
  return {
    iconSize: 64,
    metaMargin: Styles.globalMargins.tiny,
    metaOneType: 'BodySemibold',
    titleType: 'BodyBold',
  }
}

export default NameWithIcon
