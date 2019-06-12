import * as React from 'react'
import {
  Avatar,
  Box2,
  HeaderHocHeader,
  Icon,
  iconCastPlatformStyles,
  Text,
  ConnectedUsernames,
} from '../../../../common-adapters'
import {collapseStyles, globalColors, globalMargins, isMobile, styleSheetCreate} from '../../../../styles'
import {Props} from './index.types'

const shhIconColor = globalColors.black_20
const shhIconFontSize = 24

const Wrapper = (
  props: {
    children: React.ReactNode
  } & Props
) => (
  <HeaderHocHeader
    badgeNumber={props.badgeNumber}
    onLeftAction={props.onBack}
    rightActions={
      props.pendingWaiting
        ? undefined
        : [
            {
              icon: 'iconfont-search',
              label: 'search',
              onPress: props.onToggleThreadSearch,
            },
            {
              icon: 'iconfont-info',
              label: 'Info',
              onPress: props.onToggleInfoPanel,
            },
          ]
    }
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
      <Avatar teamname={props.teamName} size={props.smallTeam ? 16 : (12 as any)} />
      <Text
        type={
          isMobile
            ? props.smallTeam
              ? 'BodyBig'
              : 'BodyTinySemibold'
            : props.smallTeam
            ? 'BodyBig'
            : 'BodySemibold'
        }
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
        <Text type="BodyBig" style={styles.channelName}>
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
        type="BodyBig"
        usernames={props.participants}
        containerStyle={styles.center}
        onUsernameClicked={props.onShowProfile}
        skipSelf={props.participants.length > 1}
      />
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Box2>
  </Wrapper>
)

const styles = styleSheetCreate({
  center: {
    justifyContent: 'center',
    textAlign: 'center',
  },
  channelHeaderContainer: {alignItems: 'center', alignSelf: 'center'},
  channelName: {
    color: globalColors.black,
  },
  channelNameLight: {
    color: globalColors.black_50,
  },
  shhIcon: {marginLeft: globalMargins.xtiny},
  usernameHeaderContainer: {alignItems: 'center', justifyContent: 'center'},
})

export {ChannelHeader, UsernameHeader}
