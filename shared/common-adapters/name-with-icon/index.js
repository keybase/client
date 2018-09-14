// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import Avatar from '../avatar'
import Box from '../box'
import ClickableBox from '../clickable-box'
import Icon, {castPlatformStyles, type IconType} from '../icon'
import Text, {type TextType} from '../text'
import ConnectedUsernames from '../usernames/container'

type Size = 'small' | 'default' | 'large'

// Exposed style props for the top-level container and box around metadata arbitrarily
export type NameWithIconProps = {|
  avatarStyle?: Styles.StylesCrossPlatform,
  colorFollowing?: boolean,
  containerStyle?: Styles.StylesCrossPlatform,
  editableIcon?: boolean,
  horizontal?: boolean,
  icon?: IconType,
  isYou?: boolean,
  metaOne?: string | React.Node,
  metaStyle?: Styles.StylesCrossPlatform,
  metaTwo?: string | React.Node,
  onClick?: (SyntheticEvent<>) => void,
  clickType?: 'tracker' | 'profile',
  onEditIcon?: any => void,
  size?: Size,
  teamname?: string,
  title?: string, // for non-users
  titleStyle?: Styles.StylesCrossPlatform,
  username?: string,
|}

// If lineclamping isn't working, try adding a static width in containerStyle
const NameWithIcon = (props: NameWithIconProps) => {
  if (props.username && props.teamname) {
    throw new Error('Can only use username or teamname in NameWithIcon; got both')
  }

  const isAvatar = !!(props.username || props.teamname)
  const commonHeight = Styles.isMobile ? 48 : 32
  const BoxComponent = props.onClick ? ClickableBox : Box
  const adapterProps = getAdapterProps(props.size || 'default', !!props.username)

  let avatarOrIcon
  if (isAvatar) {
    avatarOrIcon = (
      <Avatar
        editable={props.editableIcon}
        onEditAvatarClick={props.editableIcon ? props.onEditIcon : undefined}
        size={props.horizontal ? commonHeight : adapterProps.iconSize}
        showFollowingStatus={props.horizontal ? undefined : true}
        username={props.username}
        teamname={props.teamname}
        style={Styles.collapseStyles([props.horizontal ? styles.hAvatarStyle : {}, props.avatarStyle])}
      />
    )
  } else if (props.icon) {
    avatarOrIcon = (
      <Icon
        type={props.icon}
        style={
          props.horizontal
            ? castPlatformStyles(styles.hIconStyle)
            : {height: adapterProps.iconSize, width: adapterProps.iconSize}
        }
        fontSize={props.horizontal ? (Styles.isMobile ? 48 : 32) : adapterProps.iconSize}
      />
    )
  }
  const usernameOrTitle = props.username ? (
    <ConnectedUsernames
      onUsernameClicked={
        props.clickType === 'tracker' || props.clickType === 'profile' ? undefined : 'profile'
      }
      type={props.horizontal ? 'BodySemibold' : adapterProps.titleType}
      containerStyle={
        props.horizontal ? undefined : Styles.isMobile ? undefined : styles.vUsernameContainerStyle
      }
      inline={!props.horizontal}
      usernames={[props.username]}
      colorFollowing={props.colorFollowing}
    />
  ) : (
    <Text
      type={props.horizontal ? 'BodySemibold' : adapterProps.titleType}
      style={props.horizontal ? undefined : props.titleStyle}
    >
      {props.title}
    </Text>
  )

  const metaOne = (
    <TextOrComponent
      textType={props.horizontal ? 'BodySmall' : adapterProps.metaOneType}
      val={props.metaOne}
      style={props.horizontal ? undefined : styles.fullWidthText}
    />
  )
  const metaTwo = (
    <TextOrComponent
      textType={props.horizontal ? 'BodySmall' : adapterProps.metaOneType}
      val={props.metaTwo}
      style={props.horizontal ? undefined : styles.fullWidthText}
    />
  )
  const metas = props.horizontal ? (
    <Box style={Styles.globalStyles.flexBoxRow}>
      {metaOne}
      {!!props.metaTwo && props.horizontal && <Text type="BodySmall">&nbsp;·&nbsp;</Text>}
      {metaTwo}
    </Box>
  ) : (
    <React.Fragment>
      {metaOne}
      {metaTwo}
    </React.Fragment>
  )

  return (
    <BoxComponent
      onClick={props.onClick}
      style={Styles.collapseStyles([
        props.horizontal ? styles.hContainerStyle : styles.vContainerStyle,
        props.containerStyle,
      ])}
    >
      {avatarOrIcon}
      <Box
        style={
          props.horizontal
            ? Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, props.metaStyle])
            : Styles.collapseStyles([
                styles.metaStyle,
                styles.fullWidthTextContainer,
                {marginTop: adapterProps.metaMargin},
                props.metaStyle,
              ])
        }
      >
        {usernameOrTitle}
        {metas}
      </Box>
    </BoxComponent>
  )
}

// Render text if it's text, or identity if otherwise
const TextOrComponent = (props: {
  val: string | React.Node,
  textType: TextType,
  style?: Styles.StylesCrossPlatform,
}) => {
  if (typeof props.val === 'string') {
    return (
      <Text style={props.style} lineClamp={1} type={props.textType}>
        {props.val}
      </Text>
    )
  }
  // `return undefined` makes react barf
  return props.val || null
}

const styles = Styles.styleSheetCreate({
  fullWidthText: Styles.platformStyles({isElectron: {width: '100%', whiteSpace: 'nowrap', display: 'unset'}}),
  fullWidthTextContainer: Styles.platformStyles({isElectron: {width: '100%', textAlign: 'center'}}),
  hAvatarStyle: Styles.platformStyles({
    isElectron: {marginRight: Styles.globalMargins.tiny},
    isMobile: {marginRight: Styles.globalMargins.small},
  }),
  hContainerStyle: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  hIconStyle: {
    height: Styles.isMobile ? 48 : 32,
    marginRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.tiny,
    width: Styles.isMobile ? 48 : 32,
  },
  metaStyle: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.flexBoxCenter,
    marginTop: Styles.globalMargins.tiny,
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
})

// Get props to pass to subcomponents (Text, Avatar, etc.)
const getAdapterProps = (size: Size, isUser: boolean) => {
  switch (size) {
    case 'small':
      return {
        iconSize: isUser ? 64 : 48,
        metaMargin: isUser ? 4 : 8,
        metaOneType: 'BodySmall',
        titleType: 'BodySemibold',
      }
    case 'large':
      if (isUser) {
        return {
          iconSize: 128,
          metaMargin: 8,
          metaOneType: 'BodySemibold',
          titleType: 'HeaderBig',
        }
      }
  }
  // default
  return {
    iconSize: isUser ? 96 : 64,
    metaMargin: Styles.isMobile ? 6 : 8,
    metaOneType: isUser ? 'BodySemibold' : 'BodySmall',
    titleType: 'HeaderBig',
  }
}

export default NameWithIcon
