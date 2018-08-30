// @flow
import * as React from 'react'
import Avatar from './avatar'
import Box from './box'
import ClickableBox from './clickable-box'
import Icon, {castPlatformStyles, type IconType} from './icon'
import Text, {type TextType} from './text'
import {ConnectedUsernames} from './usernames'
import {
  collapseStyles,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
  type StylesCrossPlatform,
} from '../styles'

type Size = 'small' | 'default' | 'large'

// Exposed style props for the top-level container and box around metadata arbitrarily
type Props = {
  horizontal?: boolean,
  colorFollowing?: boolean,
  editableIcon?: boolean,
  icon?: IconType,
  title?: string, // for non-users
  titleStyle?: StylesCrossPlatform,
  metaOne?: string | React.Node,
  metaTwo?: string | React.Node,
  onClick?: any => void,
  onEditIcon?: any => void,
  size?: Size,
  containerStyle?: StylesCrossPlatform,
  metaStyle?: StylesCrossPlatform,
  avatarStyle?: StylesCrossPlatform,
  isYou?: boolean,
  teamname?: string,
  username?: string,
}

// If lineclamping isn't working, try adding a static width in containerStyle
const NameWithIcon = (props: Props) => {
  if (props.username && props.teamname) {
    throw new Error('Can only use username or teamname in NameWithIcon; got both')
  }

  const isAvatar = !!(props.username || props.teamname)
  const commonHeight = isMobile ? 48 : 32
  const BoxComponent = props.onClick ? ClickableBox : Box
  const adapterProps = getAdapterProps(props.size || 'default', !!props.username)

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
    <Box style={globalStyles.flexBoxRow}>
      {metaOne}
      {props.metaTwo && props.horizontal && <Text type="BodySmall">&nbsp;·&nbsp;</Text>}
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
      style={collapseStyles([
        props.horizontal ? styles.hContainerStyle : styles.vContainerStyle,
        props.containerStyle,
      ])}
    >
      {isAvatar && (
        <Avatar
          editable={props.editableIcon}
          onEditAvatarClick={props.editableIcon ? props.onEditIcon : undefined}
          size={props.horizontal ? commonHeight : adapterProps.iconSize}
          showFollowingStatus={props.horizontal ? undefined : true}
          username={props.username}
          teamname={props.teamname}
          style={collapseStyles([props.horizontal ? styles.hAvatarStyle : {}, props.avatarStyle])}
        />
      )}
      {/* TODO switch this to collapseStyles when Icon is fixed */}
      {!isAvatar &&
        !!props.icon && (
          <Icon
            type={props.icon}
            style={
              props.horizontal
                ? castPlatformStyles(styles.hIconStyle)
                : {height: adapterProps.iconSize, width: adapterProps.iconSize}
            }
            fontSize={props.horizontal ? (isMobile ? 48 : 32) : adapterProps.iconSize}
          />
        )}
      <Box
        style={
          props.horizontal
            ? collapseStyles([globalStyles.flexBoxColumn, props.metaStyle])
            : collapseStyles([
                styles.metaStyle,
                styles.fullWidthTextContainer,
                {marginTop: adapterProps.metaMargin},
                props.metaStyle,
              ])
        }
      >
        {!props.username && (
          <Text
            type={props.horizontal ? 'BodySemibold' : adapterProps.titleType}
            style={props.horizontal ? undefined : props.titleStyle}
          >
            {props.title}
          </Text>
        )}
        {!!props.username && (
          <ConnectedUsernames
            clickable={true}
            type={props.horizontal ? 'BodySemibold' : adapterProps.titleType}
            containerStyle={
              props.horizontal ? undefined : isMobile ? undefined : styles.vUsernameContainerStyle
            }
            inline={!props.horizontal}
            usernames={[props.username]}
            colorFollowing={props.colorFollowing}
          />
        )}
        {metas}
      </Box>
    </BoxComponent>
  )
}

// Render text if it's text, or identity if otherwise
const TextOrComponent = (props: {
  val: string | React.Node,
  textType: TextType,
  style?: StylesCrossPlatform,
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

const styles = styleSheetCreate({
  fullWidthText: platformStyles({isElectron: {width: '100%', whiteSpace: 'nowrap', display: 'unset'}}),
  fullWidthTextContainer: platformStyles({isElectron: {width: '100%', textAlign: 'center'}}),
  hAvatarStyle: {marginRight: 16},
  hContainerStyle: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  hIconStyle: {
    height: isMobile ? 48 : 32,
    marginRight: 16,
    width: isMobile ? 48 : 32,
  },
  metaStyle: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexBoxCenter,
    marginTop: 8,
  },
  vContainerStyle: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
  },
  vUsernameContainerStyle: platformStyles({
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
    metaMargin: isMobile ? 6 : 8,
    metaOneType: isUser ? 'BodySemibold' : 'BodySmall',
    titleType: 'HeaderBig',
  }
}

export default NameWithIcon
export type {Props}
