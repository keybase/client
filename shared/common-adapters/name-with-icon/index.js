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
  metaTwo?: string | React.Node, // If components such as metaOne or metaTwo are passed in to NameWithIcon with click handlers and NameWithIcon has its own onClick handler,
  // both will fire unless the inner clicks call `event.preventDefault()`
  onClick?: () => void,
  clickType?: 'tracker' | 'profile',
  onEditIcon?: any => void,
  size?: Size,
  teamname?: string,
  // for non-users
  title?: string,
  titleStyle?: Styles.StylesCrossPlatform,
  underline?: boolean,
  username?: string,
|}

// If lineclamping isn't working, try adding a static width in containerStyle
class NameWithIcon extends React.Component<NameWithIconProps> {
  _onClickWrapper = (event: SyntheticEvent<>) => {
    if (!event.defaultPrevented && this.props.onClick) {
      this.props.onClick()
    }
  }

  render() {
    if (this.props.username && this.props.teamname) {
      throw new Error('Can only use username or teamname in NameWithIcon; got both')
    }

    const isAvatar = !!(this.props.username || this.props.teamname)
    const commonHeight = Styles.isMobile ? 48 : 32
    const BoxComponent = this.props.onClick ? ClickableBox : Box
    const adapterProps = getAdapterProps(this.props.size || 'default', !!this.props.username)

    let avatarOrIcon
    if (isAvatar) {
      avatarOrIcon = (
        <Avatar
          editable={this.props.editableIcon}
          onEditAvatarClick={this.props.editableIcon ? this.props.onEditIcon : undefined}
          size={this.props.horizontal ? commonHeight : adapterProps.iconSize}
          showFollowingStatus={this.props.horizontal ? undefined : true}
          username={this.props.username}
          teamname={this.props.teamname}
          style={Styles.collapseStyles([
            this.props.horizontal ? styles.hAvatarStyle : {},
            this.props.avatarStyle,
          ])}
        />
      )
    } else if (this.props.icon) {
      avatarOrIcon = (
        <Icon
          type={this.props.icon}
          style={
            this.props.horizontal
              ? castPlatformStyles(styles.hIconStyle)
              : {height: adapterProps.iconSize, width: adapterProps.iconSize}
          }
          fontSize={this.props.horizontal ? (Styles.isMobile ? 48 : 32) : adapterProps.iconSize}
        />
      )
    }
    const usernameOrTitle = this.props.username ? (
      <ConnectedUsernames
        onUsernameClicked={
          this.props.clickType === 'tracker' || this.props.clickType === 'profile' ? undefined : 'profile'
        }
        type={this.props.horizontal ? 'BodySemibold' : adapterProps.titleType}
        containerStyle={
          this.props.horizontal ? undefined : Styles.isMobile ? undefined : styles.vUsernameContainerStyle
        }
        inline={!this.props.horizontal}
        underline={this.props.underline}
        usernames={[this.props.username]}
        colorFollowing={this.props.colorFollowing}
      />
    ) : (
      <Text
        type={this.props.horizontal ? 'BodySemibold' : adapterProps.titleType}
        style={this.props.horizontal ? undefined : this.props.titleStyle}
      >
        {this.props.title}
      </Text>
    )

    const metaOne = (
      <TextOrComponent
        textType={this.props.horizontal ? 'BodySmall' : adapterProps.metaOneType}
        val={this.props.metaOne}
        style={this.props.horizontal ? undefined : styles.fullWidthText}
      />
    )
    const metaTwo = (
      <TextOrComponent
        textType={this.props.horizontal ? 'BodySmall' : adapterProps.metaOneType}
        val={this.props.metaTwo}
        style={this.props.horizontal ? undefined : styles.fullWidthText}
      />
    )
    const metas = this.props.horizontal ? (
      <Box style={Styles.globalStyles.flexBoxRow}>
        {metaOne}
        {!!(this.props.metaTwo && this.props.metaOne) && <Text type="BodySmall">&nbsp;·&nbsp;</Text>}
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
        onClick={this.props.onClick ? this._onClickWrapper : undefined}
        style={Styles.collapseStyles([
          this.props.horizontal ? styles.hContainerStyle : styles.vContainerStyle,
          this.props.containerStyle,
        ])}
      >
        {avatarOrIcon}
        <Box
          style={
            this.props.horizontal
              ? Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, this.props.metaStyle])
              : Styles.collapseStyles([
                  styles.metaStyle,
                  styles.fullWidthTextContainer,
                  {marginTop: adapterProps.metaMargin},
                  this.props.metaStyle,
                ])
          }
        >
          {usernameOrTitle}
          {metas}
        </Box>
      </BoxComponent>
    )
  }
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
