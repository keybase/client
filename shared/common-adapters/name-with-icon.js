// @flow
import * as React from 'react'
import Avatar, {type AvatarSize} from './avatar'
import Box from './box'
import ClickableBox from './clickable-box'
import Icon from './icon'
import {type IconType} from './icon.constants'
import Text, {type TextType} from './text'
import {Usernames} from './usernames'
import {collapseStyles, globalStyles, isMobile, styleSheetCreate} from '../styles'

type Size = 'small' | 'default' | 'large'

// Exposed style props for the top-level container and box around metadata arbitrarily
type Props = {
  following?: boolean,
  followsMe?: boolean,
  horizontal?: boolean,
  colorFollowing?: boolean,
  icon?: IconType,
  title?: string, // for non-users
  metaOne?: string | React.Node,
  metaTwo?: string | React.Node,
  onClick?: any => void,
  size?: Size,
  containerStyle?: any,
  metaStyle?: any,
  isYou?: boolean,
  teamname?: string,
  username?: string,
}

const NameWithIconVertical = (props: Props) => {
  const isAvatar = !!(props.username || props.avatar)
  const adapterProps = getAdapterProps(props.size || 'default', !!props.username)
  const BoxComponent = props.onClick ? ClickableBox : Box
  return (
    <BoxComponent
      onClick={props.onClick}
      style={collapseStyles([styles.vContainerStyle, props.containerStyle || {}])}
    >
      {isAvatar && (
        <Avatar
          size={adapterProps.iconSize}
          following={props.following}
          followsYou={props.followsMe}
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
              fontSize: adapterProps.iconSize,
              height: adapterProps.iconSize,
              width: adapterProps.iconSize,
            }}
          />
        )}
      <Box
        style={collapseStyles([
          styles.metaStyle,
          {marginTop: adapterProps.metaMargin},
          props.metaStyle || {},
        ])}
      >
        {!props.username && <Text type={adapterProps.titleType}>{props.title}</Text>}
        {!!props.username && (
          // TODO get lineclamping working here
          <Usernames
            type={adapterProps.titleType}
            containerStyle={isMobile ? undefined : styles.vUsernameContainerStyle}
            inline={true}
            users={[{following: props.following, username: props.username, you: props.isYou}]}
            colorFollowing={props.colorFollowing}
          />
        )}
        <TextOrComponent textType={adapterProps.metaOneType} val={props.metaOne} />
        <TextOrComponent textType="BodySmall" val={props.metaTwo} />
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
      style={collapseStyles([styles.hContainerStyle, props.containerStyle || {}])}
    >
      {isAvatar && (
        <Avatar
          size={commonHeight}
          username={props.username}
          teamname={props.teamname}
          style={{marginRight: 16}}
        />
      )}
      {!isAvatar && !!props.icon && <Icon type={props.icon} style={styles.hIconStyle} />}
      <Box style={collapseStyles([globalStyles.flexBoxColumn, props.metaStyle || {}])}>
        {!props.username && <Text type="BodySemibold">{props.title}</Text>}
        {!!props.username && (
          <Usernames
            type="BodySemibold"
            users={[{following: props.following, username: props.username, you: props.isYou}]}
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
    throw new Error('Can onlt use username or teamname in NameWithIcon; got both')
  }
  return props.horizontal ? <NameWithIconHorizontal {...props} /> : <NameWithIconVertical {...props} />
}

// Render text if it's text, or identity if otherwise
const TextOrComponent = ({val, textType}: {val: string | React.Node, textType: TextType}) => {
  if (typeof val === 'string') {
    return (
      <Text lineClamp={1} type={textType}>
        {val}
      </Text>
    )
  }
  // `return undefined` makes react barf
  return val || null
}

const styles = styleSheetCreate({
  hAvatarStyle: {marginRight: 16},
  hContainerStyle: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  hIconStyle: {
    fontSize: isMobile ? 48 : 32,
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
  vUsernameContainerStyle: {
    textAlign: 'center',
  },
})

// Get props to pass to subcomponents (Text, Avatar, etc.)
const getAdapterProps = (size: Size, isAvatar: boolean) => {
  switch (size) {
    case 'small':
      return {
        iconSize: isAvatar ? 64 : 48,
        metaMargin: isAvatar ? 4 : 8,
        metaOneType: 'BodySmall',
        titleType: 'BodySemibold',
      }
    case 'large':
      if (isAvatar) {
        return {
          iconSize: 112,
          metaMargin: 8,
          metaOneType: 'BodySemibold',
          titleType: 'HeaderBig',
        }
      }
  }
  // default
  return {
    iconSize: isAvatar ? 80 : 64,
    metaMargin: isMobile ? 6 : 8,
    metaOneType: isAvatar ? 'BodySemibold' : 'BodySmall',
    titleType: 'BodyBig',
  }
}

export default NameWithIcon
export type {Props}
