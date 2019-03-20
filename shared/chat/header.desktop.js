// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Constants from '../constants/chat2'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as Styles from '../styles'
import * as Container from '../util/container'
import {GatewayDest} from 'react-gateway'

type OwnProps = {||}

type Props = {|
  channel: ?string,
  desc: string,
  infoPanelOpen: boolean,
  onToggleInfoPanel: () => void,
  onOpenFolder: () => void,
  participants: ?Array<string>,
|}

const Header = (p: Props) => {
  return (
    <Kb.Box2 direction="horizontal" style={styles.container}>
      <Kb.Box2 direction="vertical" style={styles.left}>
        <GatewayDest name="chatHeader" />
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        style={styles.right}
        gap="small"
        alignItems="flex-end"
        alignSelf="flex-end"
      >
        <Kb.Box2 direction="vertical" style={styles.grow}>
          {p.channel ? (
            <Kb.Text type="Header">{p.channel}</Kb.Text>
          ) : p.participants ? (
            <Kb.ConnectedUsernames
              colorFollowing={true}
              underline={true}
              inline={false}
              commaColor={Styles.globalColors.black_50}
              type="Header"
              usernames={p.participants}
              onUsernameClicked="profile"
              skipSelf={p.participants.length > 1 /* length ===1 means just you so show yourself */}
            />
          ) : null}
          {!!p.desc && <Kb.Text type="BodyTiny">{p.desc}</Kb.Text>}
        </Kb.Box2>
        <Kb.Icon type="iconfont-folder-private" onClick={p.onOpenFolder} />
        <Kb.Icon type={p.infoPanelOpen ? 'iconfont-close' : 'iconfont-info'} onClick={p.onToggleInfoPanel} />
      </Kb.Box2>
    </Kb.Box2>
  )
}
// }

const styles = Styles.styleSheetCreate({
  container: {
    flexGrow: 1,
    height: 40,
  },
  grow: {flexGrow: 1},
  left: {width: 260},
  right: {
    flexGrow: 1,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
})

const mapStateToProps = state => {
  const _conversationIDKey = Constants.getSelectedConversation(state)
  const _meta = Constants.getMeta(state, _conversationIDKey)

  return {
    _conversationIDKey,
    _meta,
    infoPanelOpen: Constants.isInfoPanelOpen(state),
  }
}
const mapDispatchToProps = dispatch => ({
  _onOpenFolder: conversationIDKey => dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
  onToggleInfoPanel: () => dispatch(Chat2Gen.createToggleInfoPanel()),
})
const mergeProps = (stateProps, dispatchProps) => {
  const meta = stateProps._meta
  return {
    channel:
      meta.teamType === 'big'
        ? `${meta.teamname}#${meta.channelname}`
        : meta.teamType === 'small'
        ? meta.teamname
        : null,
    desc: meta.description,
    infoPanelOpen: false, // not really needed stateProps.infoPanelOpen,
    onOpenFolder: () => dispatchProps._onOpenFolder(stateProps._conversationIDKey),
    onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
    participants: meta.teamType === 'adhoc' ? meta.participants.toArray() : null,
  }
}

const Connected = Container.connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Header)

export default Connected
