import * as React from 'react'
import * as Styles from '../../styles'
import Avatar, {AvatarSize} from '../avatar'
import Box from '../box'
import ClickableBox from '../clickable-box'
import Icon, {castPlatformStyles, IconType} from '../icon'
import Text, {TextType, StylesTextCrossPlatform} from '../text'
import ConnectedUsernames from '../usernames/container'

type Size = 'smaller' | 'small' | 'default' | 'big' | 'huge'

// Exposed style props for the top-level container and box around metadata arbitrarily
export type NameWithIconProps = {
  avatarImageOverride?: string
  avatarSize?: AvatarSize
  avatarStyle?: Styles.StylesCrossPlatform
  colorBroken?: boolean
  colorFollowing?: boolean
  notFollowingColorOverride?: string
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
}

// If lineclamping isn't working, try adding a static width in containerStyle
class NameWithIcon extends React.Component<NameWithIconProps> {
  _onClickWrapper = (event: React.SyntheticEvent) => {
    if (!event.defaultPrevented && this.props.onClick) {
      this.props.username && this.props.onClick(this.props.username)
    }
  }

  render() {
    if (this.props.username && this.props.teamname) {
      throw new Error('Can only use username or teamname in NameWithIcon; got both')
    }

    const isAvatar = !!(this.props.username || this.props.teamname) && !this.props.icon
    const commonHeight = Styles.isMobile ? 48 : 32
    const BoxComponent = this.props.onClick ? ClickableBox : Box
    const adapterProps = getAdapterProps(this.props.size || 'default')

    let avatarOrIcon
    if (isAvatar) {
      avatarOrIcon = (
        <Avatar
          imageOverrideUrl={this.props.avatarImageOverride}
          editable={this.props.editableIcon}
          onEditAvatarClick={this.props.editableIcon ? this.props.onEditIcon : undefined}
          size={
            this.props.avatarSize || (this.props.horizontal ? commonHeight : (adapterProps.iconSize as any))
          }
          showFollowingStatus={this.props.horizontal ? undefined : !this.props.hideFollowingOverlay}
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
          boxStyle={this.props.iconBoxStyle}
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
    const username = this.props.username || ''
    const title = this.props.title || ''
    const usernameOrTitle = title ? (
      <TextOrComponent
        textType={this.props.horizontal ? 'BodySemibold' : adapterProps.titleType}
        style={this.props.horizontal ? undefined : this.props.titleStyle}
        val={this.props.title || ''}
      />
    ) : (
      <ConnectedUsernames
        onUsernameClicked={this.props.clickType === 'onClick' ? this.props.onClick : 'profile'}
        type={this.props.horizontal ? 'BodySemibold' : adapterProps.titleType}
        containerStyle={Styles.collapseStyles([
          !this.props.horizontal && !Styles.isMobile && styles.vUsernameContainerStyle,
          this.props.size === 'smaller' && styles.smallerWidthTextContainer,
        ])}
        inline={!this.props.horizontal}
        underline={this.props.underline}
        selectable={this.props.selectable}
        usernames={[username]}
        colorBroken={this.props.colorBroken}
        colorFollowing={this.props.colorFollowing}
        colorYou={this.props.notFollowingColorOverride}
        notFollowingColorOverride={this.props.notFollowingColorOverride}
        style={this.props.size === 'smaller' ? {} : styles.fullWidthText}
      />
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
                  Styles.globalStyles.flexBoxRow,
                  styles.metaStyle,
                  this.props.size === 'smaller'
                    ? styles.smallerWidthTextContainer
                    : styles.fullWidthTextContainer,
                  {marginTop: adapterProps.metaMargin},
                  this.props.metaStyle,
                  this.props.size === 'smaller' ? styles.smallerWidthTextContainer : {},
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

const styles = Styles.styleSheetCreate({
  fullWidthText: Styles.platformStyles({
    isElectron: {display: 'unset', whiteSpace: 'nowrap', width: '100%', wordBreak: 'break-all'},
  }),
  fullWidthTextContainer: Styles.platformStyles({isElectron: {textAlign: 'center', width: '100%'}}),
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
const getAdapterProps = (
  size: Size
): {iconSize: number; metaMargin: number; metaOneType: TextType; titleType: TextType} => {
  switch (size) {
    case 'smaller':
      return {
        iconSize: 48,
        metaMargin: 6,
        metaOneType: 'BodySmall',
        titleType: 'BodyTinySemibold',
      }
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
