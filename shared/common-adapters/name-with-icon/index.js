// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import Avatar, {type AvatarSize} from '../avatar'
import Box from '../box'
import ClickableBox from '../clickable-box'
import Icon, {castPlatformStyles, type IconType} from '../icon'
import Text, {type TextType} from '../text'
import ConnectedUsernames from '../usernames/container'

type Size = 'small' | 'default' | 'big' | 'huge'

// Exposed style props for the top-level container and box around metadata arbitrarily
export type NameWithIconProps = {|
  avatarSize?: AvatarSize,
  avatarStyle?: Styles.StylesCrossPlatform,
  colorBroken?: boolean,
  colorFollowing?: boolean,
  notFollowingColorOverride?: string,
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
  onEditIcon?: ?(e?: SyntheticEvent<Element>) => void,
  selectable?: boolean,
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
    const adapterProps = getAdapterProps(this.props.size || 'default')

    let avatarOrIcon
    if (isAvatar) {
      avatarOrIcon = (
        <Avatar
          editable={this.props.editableIcon}
          onEditAvatarClick={this.props.editableIcon ? this.props.onEditIcon : undefined}
          size={this.props.avatarSize || (this.props.horizontal ? commonHeight : adapterProps.iconSize)}
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
        selectable={this.props.selectable}
        usernames={[this.props.username]}
        colorBroken={this.props.colorBroken}
        colorFollowing={this.props.colorFollowing}
        colorYou={this.props.notFollowingColorOverride}
        notFollowingColorOverride={this.props.notFollowingColorOverride}
        style={styles.fullWidthText}
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
        val={this.props.metaOne || null}
        style={this.props.horizontal ? undefined : styles.fullWidthText}
      />
    )
    const metaTwo = (
      <TextOrComponent
        textType="BodySmall"
        val={this.props.metaTwo || null}
        style={this.props.horizontal ? undefined : styles.fullWidthText}
      />
    )
    const metas = this.props.horizontal ? (
      <Box style={styles.metasBox}>
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
  fullWidthText: Styles.platformStyles({
    isElectron: {display: 'unset', whiteSpace: 'nowrap', width: '100%', wordBreak: 'break-all'},
  }),
  fullWidthTextContainer: Styles.platformStyles({isElectron: {textAlign: 'center', width: '100%'}}),
  hAvatarStyle: Styles.platformStyles({
    isElectron: {marginRight: Styles.globalMargins.small},
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
  metasBox: {
    ...Styles.globalStyles.flexBoxRow,
    maxWidth: '100%',
    width: '100%',
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
const getAdapterProps = (size: Size) => {
  switch (size) {
    case 'small':
      return {
        iconSize: 48,
        metaMargin: Styles.globalMargins.tiny,
        metaOneType: 'BodySmall',
        titleType: 'BodySemibold',
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
    titleType: 'BodySemibold',
  }
}

export default NameWithIcon
