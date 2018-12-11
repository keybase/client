// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type {Props} from './index.types'

const Wrapper = (props: {
  badgeNumber: number,
  children: React.Node,
  onBack: () => void,
  onToggleInfoPanel: () => void,
}) => (
  <Kb.HeaderHocHeader
    onLeftAction={props.onBack}
    badgeNumber={props.badgeNumber}
    children={props.children}
    rightActions={[{
      icon: 'iconfont-info',
      label: 'Info',
      onPress: props.onToggleInfoPanel,
    }]}
  />
)

const ShhIcon = props => (
  <Kb.Icon
    type="iconfont-shh"
    style={Kb.iconCastPlatformStyles(styles.shhIcon)}
    color={Styles.globalColors.black_20}
    fontSize={24}
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
    <>
      <Kb.ConnectedUsernames
        colorFollowing={true}
        inline={false}
        commaColor={Styles.globalColors.black_40}
        type={Styles.isMobile ? 'BodySemibold' : 'BodyBig'}
        usernames={props.participants}
        onUsernameClicked={props.onShowProfile}
        skipSelf={props.participants.length > 1}
      />
      {props.muted && <ShhIcon onClick={props.unMuteConversation} />}
    </>
  </Wrapper>
)

const styles = Styles.styleSheetCreate({
  channelHeaderContainer: {alignItems: 'center', alignSelf: 'center'},
  channelName: {
    color: Styles.globalColors.black_75,
  },
  channelNameLight: {
    color: Styles.globalColors.black_40,
  },
  shhIcon: {marginLeft: Styles.globalMargins.xtiny},
})

export {ChannelHeader, UsernameHeader}
