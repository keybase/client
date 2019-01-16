// @flow
import * as React from 'react'
import {
  Avatar,
  Badge,
  Box2,
  ClickableBox,
  HeaderHocHeader,
  Icon,
  iconCastPlatformStyles,
  Text,
  ConnectedUsernames,
} from '../../../../common-adapters'
import {collapseStyles, globalStyles, globalColors, globalMargins, isMobile, styleSheetCreate} from '../../../../styles'
import type {Props} from './index.types'

// width of containers for back button and info button.
// must be increased if something else will go in those,
// remember to check that nothing overflows on android!
const marginWidth = 60
const shhIconColor = globalColors.black_20
const shhIconFontSize = 24

const Wrapper = (props: {
  badgeNumber: number,
  children: React.Node,
  onBack: () => void,
  onToggleInfoPanel: () => void,
}) => (
  <HeaderHocHeader
    badgeNumber={props.badgeNumber}
    onLeftAction={props.onBack}
    rightActions={[{
      icon: 'iconfont-info',
      label: 'Info',
      onPress: props.onToggleInfoPanel,
    }]}
    titleComponent={props.children}
  />
)

const ShhIcon = props => (
  <Icon
    type="iconfont-shh"
    style={iconCastPlatformStyles(styles.shhIcon)}
    color={shhIconColor}
    fontSize={shhIconFontSize}
    onClick={props.onClick}
  />
)

const ChannelHeader = (props: Props) => (
  <Wrapper {...props}>
    <Box2 direction="horizontal" style={styles.channelHeaderContainer}>
      <Avatar teamname={props.teamName} size={12} />
      <Text
        type={isMobile
          ? props.smallTeam
            ? 'BodySemibold'
            : 'BodyTinySemibold'
          : props.smallTeam
            ? 'BodyBig'
            : 'BodySmallSemibold'}
        lineClamp={1}
        ellipsizeMode="middle"
        style={collapseStyles([styles.channelName, !props.smallTeam && styles.channelNameLight])}
      >
        &nbsp;
        {props.teamName}
      </Text>
      {props.smallTeam && props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Box2>
    {!props.smallTeam && (
      <Box2 direction="horizontal" style={styles.channelHeaderContainer}>
        <Text type={isMobile ? 'BodySemibold' : 'BodyBig'} style={styles.channelName}>
          #{props.channelName}
        </Text>
        {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
      </Box2>
    )}
  </Wrapper>
)

const UsernameHeader = (props: Props) => (
  <Wrapper {...props}>
    <Box2 direction="horizontal" style={styles.usernameHeaderContainer}>
      <ConnectedUsernames
        colorFollowing={true}
        inline={false}
        commaColor={globalColors.black_50}
        type={isMobile ? 'BodySemibold' : 'BodyBig'}
        usernames={props.participants}
        containerStyle={styles.center}
        onUsernameClicked={props.onShowProfile}
        skipSelf={props.participants.length > 1}
      />
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Box2>
  </Wrapper>
)

const marginStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  width: marginWidth,
}

const styles = styleSheetCreate({
  arrow: {marginRight: -3, marginTop: 3},
  center: {
    justifyContent: 'center',
    textAlign: 'center',
  },
  channelHeaderContainer: {alignItems: 'center', alignSelf: 'center'},
  channelName: {
    color: globalColors.black_75,
  },
  channelNameLight: {
    color: globalColors.black_50,
  },
  container: {
    alignItems: 'stretch',
    backgroundColor: globalColors.red,//globalColors.fastBlank,
    borderBottomColor: globalColors.black_10,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  contentContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  extraCenterPadding: {paddingLeft: globalMargins.tiny, paddingRight: globalMargins.tiny},
  leftMargin: {
    ...marginStyle,
    justifyContent: 'flex-start',
    paddingLeft: globalMargins.small,
  },
  rightMargin: {
    ...marginStyle,
    justifyContent: 'flex-end',
    paddingRight: globalMargins.small,
  },
  shhIcon: {marginLeft: globalMargins.xtiny},
  usernameHeaderContainer: {alignItems: 'center', justifyContent: 'center'},
})

export {ChannelHeader, UsernameHeader}
