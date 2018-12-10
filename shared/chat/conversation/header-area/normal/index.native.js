// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type {Props} from './index.types'

// width of containers for back button and info button.
// must be increased if something else will go in those,
// remember to check that nothing overflows on android!
const marginWidth = 60
const shhIconColor = Styles.globalColors.black_20
const shhIconFontSize = 24

const Wrapper = (props: {
  badgeNumber: number,
  children: React.Node,
  onBack: () => void,
  onToggleInfoPanel: () => void,
}) => (
  <Kb.Box2 direction="horizontal" style={styles.container}>
    <Kb.ClickableBox onClick={props.onBack} style={styles.leftMargin}>
      <Kb.Icon
        type="iconfont-arrow-left"
        fontSize={24}
        color={Styles.globalColors.black_40}
        style={Kb.iconCastPlatformStyles(styles.arrow)}
      />
      {!!props.badgeNumber && <Kb.Badge badgeNumber={props.badgeNumber} />}
    </Kb.ClickableBox>
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([styles.contentContainer, !!props.badgeNumber && styles.extraCenterPadding])}
    >
      {props.children}
    </Kb.Box2>
    <Kb.ClickableBox onClick={props.onToggleInfoPanel} style={styles.rightMargin}>
      <Kb.Icon type="iconfont-info" fontSize={24} />
    </Kb.ClickableBox>
  </Kb.Box2>
)

const ShhIcon = props => (
  <Kb.Icon
    type="iconfont-shh"
    style={Kb.iconCastPlatformStyles(styles.shhIcon)}
    color={shhIconColor}
    fontSize={shhIconFontSize}
    onClick={props.onClick}
  />
)

const ChannelHeader = (props: Props) => (
  <Wrapper {...props}>
    <Kb.Box2 direction="horizontal" style={styles.channelHeaderContainer}>
      <Kb.Avatar teamname={props.teamName} size={16} />
      <Kb.Text
        type={Styles.isMobile
          ? 'BodySemibold'
          : props.smallTeam
            ? 'BodyBig'
            : 'BodySmallSemibold'}
        lineClamp={1}
        ellipsizeMode="middle"
        style={Styles.collapseStyles([styles.channelName, !props.smallTeam && styles.channelNameLight])}
      >
        &nbsp;
        {props.teamName}
      </Kb.Text>
      {props.smallTeam && props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Kb.Box2>
    {!props.smallTeam && (
      <Kb.Box2 direction="horizontal" style={styles.channelHeaderContainer}>
        <Kb.Text type={Styles.isMobile ? 'BodySemibold' : 'BodyBig'} style={styles.channelName}>
          #{props.channelName}
        </Kb.Text>
        {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
      </Kb.Box2>
    )}
  </Wrapper>
)

const UsernameHeader = (props: Props) => (
  <Wrapper {...props}>
    <Kb.Box2 direction="horizontal" style={styles.usernameHeaderContainer}>
      <Kb.ConnectedUsernames
        colorFollowing={true}
        inline={false}
        commaColor={Styles.globalColors.black_40}
        type={Styles.isMobile ? 'BodySemibold' : 'BodyBig'}
        usernames={props.participants}
        containerStyle={styles.center}
        onUsernameClicked={props.onShowProfile}
        skipSelf={props.participants.length > 1}
      />
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </Kb.Box2>
  </Wrapper>
)

const marginStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  width: marginWidth,
}

const styles = Styles.styleSheetCreate({
  arrow: {marginRight: -3, marginTop: 3},
  center: {
    justifyContent: 'center',
    textAlign: 'center',
  },
  channelHeaderContainer: {alignItems: 'center', alignSelf: 'center'},
  channelName: {
    color: Styles.globalColors.black_75,
  },
  channelNameLight: {
    color: Styles.globalColors.black_40,
  },
  container: {
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.fastBlank,
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    minHeight: 44,
  },
  contentContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  extraCenterPadding: {paddingLeft: Styles.globalMargins.tiny, paddingRight: Styles.globalMargins.tiny},
  leftMargin: {
    ...marginStyle,
    justifyContent: 'flex-start',
    paddingLeft: Styles.globalMargins.small,
  },
  rightMargin: {
    ...marginStyle,
    justifyContent: 'flex-end',
    paddingRight: Styles.globalMargins.small,
  },
  shhIcon: {marginLeft: Styles.globalMargins.xtiny},
  usernameHeaderContainer: {alignItems: 'center', justifyContent: 'center'},
})

export {ChannelHeader, UsernameHeader}
