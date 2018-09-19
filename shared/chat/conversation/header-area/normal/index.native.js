// @flow
import * as React from 'react'
import {
  Avatar,
  Badge,
  Box2,
  ClickableBox,
  Icon,
  iconCastPlatformStyles,
  Text,
  ConnectedUsernames,
} from '../../../../common-adapters'
import {collapseStyles, globalStyles, globalColors, globalMargins, styleSheetCreate} from '../../../../styles'
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
  <Box2 direction="horizontal" style={styles.container}>
    <ClickableBox onClick={props.onBack} style={styles.leftMargin}>
      <Icon
        type="iconfont-arrow-left"
        fontSize={24}
        color={globalColors.black_40}
        style={iconCastPlatformStyles(styles.arrow)}
      />
      {!!props.badgeNumber && <Badge badgeNumber={props.badgeNumber} />}
    </ClickableBox>
    <Box2
      direction="vertical"
      style={collapseStyles([styles.contentContainer, !!props.badgeNumber && styles.extraCenterPadding])}
    >
      {props.children}
    </Box2>
    <ClickableBox onClick={props.onToggleInfoPanel} style={styles.rightMargin}>
      <Icon type="iconfont-info" fontSize={24} />
    </ClickableBox>
  </Box2>
)

const ShhIcon = (props) => (
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
      <Avatar teamname={props.teamName} size={16} />
      <Text
        type={props.smallTeam ? 'BodyBig' : 'BodySmallSemibold'}
        lineClamp={1}
        ellipsizeMode="middle"
        style={{color: props.smallTeam ? globalColors.black_75 : globalColors.black_40}}
      >
        &nbsp;{props.teamName}
      </Text>
      {props.smallTeam && props.muted && <ShhIcon onClick={props.muteConversation} />}
    </Box2>
    {!props.smallTeam && (
      <Box2 direction="horizontal" style={styles.channelHeaderContainer}>
        <Text type="BodyBig" style={styles.channelName}>
          #{props.channelName}
        </Text>
        {props.muted && <ShhIcon onClick={props.muteConversation} />}
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
        commaColor={globalColors.black_40}
        type="BodyBig"
        usernames={props.participants}
        containerStyle={styles.center}
        onUsernameClicked={props.onShowProfile}
        skipSelf={props.participants.length > 1}
      />
      {props.muted && <ShhIcon onClick={props.muteConversation} />}
    </Box2>
  </Wrapper>
)

const marginStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  width: marginWidth,
}

const styles = styleSheetCreate({
  arrow: {marginTop: 3, marginRight: -3},
  center: {
    justifyContent: 'center',
    textAlign: 'center',
  },
  channelHeaderContainer: {alignItems: 'center', alignSelf: 'center'},
  channelName: {color: globalColors.black_75},
  container: {
    alignItems: 'stretch',
    backgroundColor: globalColors.fastBlank,
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
