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
import * as Styles from '../../../../styles'
import {Props} from './index.types'
import {formatPhoneNumber} from '../../../../util/phone-numbers'

const shhIconColor = Styles.globalColors.black_20
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
          Styles.isMobile
            ? props.smallTeam
              ? 'BodyBig'
              : 'BodyTinySemibold'
            : props.smallTeam
            ? 'BodyBig'
            : 'BodySemibold'
        }
        lineClamp={1}
        ellipsizeMode="middle"
        style={Styles.collapseStyles([styles.channelName, !props.smallTeam && styles.channelNameLight])}
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
        commaColor={Styles.globalColors.black_50}
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

const PhoneHeader = (props: Props) => {
  const phoneUser = props.participants.find(s => s.endsWith('@phone')) || '@phone'
  const withoutSuffix = phoneUser.substr(0, phoneUser.length - 6)
  const formattedPhoneNumber = formatPhoneNumber(withoutSuffix)
  const name = 'Max Goodman' // TODO: actually get this data
  return (
    <Wrapper {...props}>
      <Box2 direction="vertical" style={styles.usernameHeaderContainer}>
        <Box2 direction="horizontal" style={styles.lessMargins}>
          <Text type="BodyBig">{formattedPhoneNumber}</Text>
          {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
        </Box2>
        <Text type="BodyTiny">{name}</Text>
      </Box2>
    </Wrapper>
  )
}

const styles = Styles.styleSheetCreate({
  center: {
    justifyContent: 'center',
    textAlign: 'center',
  },
  channelHeaderContainer: {alignItems: 'center', alignSelf: 'center'},
  channelName: {
    color: Styles.globalColors.black,
  },
  channelNameLight: {
    color: Styles.globalColors.black_50,
  },
  lessMargins: {
    marginBottom: -5,
  },
  shhIcon: {marginLeft: Styles.globalMargins.xtiny},
  usernameHeaderContainer: {alignItems: 'center', justifyContent: 'center'},
})

export {ChannelHeader, PhoneHeader, UsernameHeader}
