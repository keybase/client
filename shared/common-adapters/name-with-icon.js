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
  icon?: IconType,
  title?: string, // for non-users
  metaOne?: string | React.Node,
  metaTwo?: string | React.Node,
  onClick?: any => void,
  size?: Size,
  containerStyle?: StylesCrossPlatform,
  metaStyle?: StylesCrossPlatform,
  isYou?: boolean,
  teamname?: string,
  username?: string,
}

// If lineclamping isn't working, try adding a static width in containerStyle
const NameWithIconVertical = (props: Props) => {
  const isAvatar = !!(props.username || props.teamname)
  const adapterProps = getAdapterProps(props.size || 'default', !!props.username)
  const BoxComponent = props.onClick ? ClickableBox : Box
  return (
    <BoxComponent
      onClick={props.onClick}
      style={collapseStyles([styles.vContainerStyle, props.containerStyle])}
    >
      {isAvatar && (
        <Avatar
          showFollowingStatus={true}
          size={adapterProps.iconSize}
          username={props.username}
          teamname={props.teamname}
        />
      )}
      {!isAvatar &&
        !!props.icon && (
          // TODO switch this to collapseStyles when Icon is fixed
          <Icon
            type={props.icon || ''}
            style={{
              height: adapterProps.iconSize,
              width: adapterProps.iconSize,
            }}
            fontSize={adapterProps.iconSize}
          />
        )}
      <Box
        style={collapseStyles([
          styles.metaStyle,
          styles.fullWidthTextContainer,
          {marginTop: adapterProps.metaMargin},
          props.metaStyle,
        ])}
      >
        {!props.username && <Text type={adapterProps.titleType}>{props.title}</Text>}
        {!!props.username && (
          <ConnectedUsernames
            type={adapterProps.titleType}
            containerStyle={isMobile ? undefined : styles.vUsernameContainerStyle}
            inline={true}
            usernames={[props.username]}
            colorFollowing={props.colorFollowing}
          />
        )}
        <TextOrComponent
          style={styles.fullWidthText}
          textType={adapterProps.metaOneType}
          val={props.metaOne}
        />
        <TextOrComponent style={styles.fullWidthText} textType="BodySmall" val={props.metaTwo} />
      </Box>
    </BoxComponent>
  )
}

const NameWithIconHorizontal = (props: Props) => {
  const isAvatar = !!(props.username || props.teamname)
  const commonHeight = isMobile ? 48 : 32
  const BoxComponent = props.onClick ? ClickableBox : Box
  return (
    <BoxComponent
      onClick={props.onClick}
      style={collapseStyles([styles.hContainerStyle, props.containerStyle])}
    >
      {isAvatar && (
        <Avatar
          size={commonHeight}
          username={props.username}
          teamname={props.teamname}
          style={{marginRight: 16}}
        />
      )}
      {!isAvatar &&
        !!props.icon && (
          <Icon
            type={props.icon}
            style={castPlatformStyles(styles.hIconStyle)}
            fontSize={isMobile ? 48 : 32}
          />
        )}
      <Box style={collapseStyles([globalStyles.flexBoxColumn, props.metaStyle])}>
        {!props.username && <Text type="BodySemibold">{props.title}</Text>}
        {!!props.username && (
          <ConnectedUsernames
            type="BodySemibold"
            usernames={[props.username]}
            colorFollowing={props.colorFollowing}
          />
        )}
        <Box style={globalStyles.flexBoxRow}>
          <TextOrComponent textType="BodySmall" val={props.metaOne} />
          {props.metaTwo && <Text type="BodySmall">&nbsp;·&nbsp;</Text>}
          <TextOrComponent textType="BodySmall" val={props.metaTwo} />
        </Box>
      </Box>
    </BoxComponent>
  )
}

// Delegator
const NameWithIcon = (props: Props) => {
  if (props.username && props.teamname) {
    throw new Error('Can only use username or teamname in NameWithIcon; got both')
  }
  return props.horizontal ? <NameWithIconHorizontal {...props} /> : <NameWithIconVertical {...props} />
}

// Render text if it's text, or identity if otherwise
const TextOrComponent = ({
  val,
  textType,
  style,
}: {
  val: string | React.Node,
  textType: TextType,
  style?: StylesCrossPlatform,
}) => {
  if (typeof val === 'string') {
    return (
      <Text style={style} lineClamp={1} type={textType}>
        {val}
      </Text>
    )
  }
  // `return undefined` makes react barf
  return val || null
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
