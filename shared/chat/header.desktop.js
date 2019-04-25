// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Constants from '../constants/chat2'
import * as TeamConstants from '../constants/teams'
import * as Chat2Gen from '../actions/chat2-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import * as Container from '../util/container'
import ChatInboxHeader from './inbox/row/chat-inbox-header/container'

type OwnProps = {||}

type Props = {|
  canEditDesc: boolean,
  channel: ?string,
  desc: string,
  infoPanelOpen: boolean,
  isTeam: boolean,
  muted: boolean,
  onOpenFolder: () => void,
  onNewChat: () => void,
  onToggleInfoPanel: () => void,
  onToggleThreadSearch: () => void,
  participants: ?Array<string>,
  showActions: boolean,
  unMuteConversation: () => void,
|}

const descStyleOverride = {
  del: {fontSize: 12, lineHeight: '16px'},
  em: {fontSize: 12, lineHeight: '16px'},
  fence: {fontSize: 12, lineHeight: '16px'},
  inlineCode: {fontSize: 12, lineHeight: '16px'},
  kbfsPath: {fontSize: 12, lineHeight: '16px'},
  link: {fontSize: 12, lineHeight: '16px'},
  mailto: {fontSize: 12, lineHeight: '16px'},
  paragraph: {fontSize: 12, lineHeight: '16px'},
  preview: {fontSize: 12, lineHeight: '16px'},
  strong: {fontSize: 12, lineHeight: '16px'},
}

const Header = (p: Props) => {
  let description = !!p.desc && (
    // $FlowIssue not used on mobile
    <Kb.Markdown style={styles.desc} styleOverride={descStyleOverride} lineClamp={1} selectable={true}>
      {p.desc}
    </Kb.Markdown>
  )
  if (p.isTeam && !p.desc && p.canEditDesc) {
    description = (
      <Kb.Text type="BodySmallItalic" lineClamp={1}>
        Set a description using the <Kb.Text type="BodySmallSemiboldItalic">/headline</Kb.Text> command.
      </Kb.Text>
    )
  }
  if (p.isTeam && p.desc && p.canEditDesc) {
    description = (
      <Kb.WithTooltip position="bottom left" text="Set the description using the /headline command.">
        {description}
      </Kb.WithTooltip>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" style={styles.container}>
      <Kb.Box2 direction="vertical" style={styles.left}>
        <ChatInboxHeader onNewChat={p.onNewChat} />
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        style={styles.right}
        gap="small"
        alignItems="flex-end"
        alignSelf="flex-end"
      >
        <Kb.Box2 direction="vertical" style={styles.grow}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            {p.channel ? (
              <Kb.Text selectable={true} type="Header" lineClamp={1}>
                {p.channel}
              </Kb.Text>
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
            {p.muted && (
              <Kb.Icon
                type="iconfont-shh"
                style={styles.shhIconStyle}
                color={Styles.globalColors.black_20}
                fontSize={20}
                onClick={p.unMuteConversation}
              />
            )}
          </Kb.Box2>
          {description}
        </Kb.Box2>
        {p.showActions && (
          <Kb.Box2 direction="horizontal" gap="small" alignItems="flex-end" alignSelf="flex-end">
            <Kb.Icon type="iconfont-search" onClick={p.onToggleThreadSearch} />
            <Kb.Icon type="iconfont-folder-private" onClick={p.onOpenFolder} />
            <Kb.Icon
              type={p.infoPanelOpen ? 'iconfont-close' : 'iconfont-info'}
              onClick={p.onToggleInfoPanel}
            />
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    flexGrow: 1,
    height: 40,
  },
  desc: {
    ...Styles.platformStyles({isElectron: Styles.desktopStyles.windowDraggingClickable}),
    color: Styles.globalColors.black_50,
  },
  grow: {flexGrow: 1},
  left: {minWidth: 260},
  right: {
    flexGrow: 1,
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
  shhIconStyle: {
    marginLeft: Styles.globalMargins.xtiny,
  },
})

const mapStateToProps = state => {
  const _conversationIDKey = Constants.getSelectedConversation(state)
  const _fullnames = state.users.infoMap
  const _meta = Constants.getMeta(state, _conversationIDKey)

  return {
    _conversationIDKey,
    _fullnames,
    _meta,
    _username: state.config.username,
    canEditDesc: TeamConstants.getCanPerform(state, _meta.teamname).editChannelDescription,
    infoPanelOpen: Constants.isInfoPanelOpen(state),
  }
}

const mapDispatchToProps = dispatch => ({
  _onOpenFolder: conversationIDKey => dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
  onNewChat: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {}, selected: 'chatNewChat'}],
      })
    ),
  onToggleInfoPanel: () => dispatch(Chat2Gen.createToggleInfoPanel()),
  onToggleThreadSearch: conversationIDKey => dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
  onUnMuteConversation: conversationIDKey =>
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
})

const mergeProps = (stateProps, dispatchProps) => {
  const meta = stateProps._meta
  const otherParticipants = Constants.getRowParticipants(meta, stateProps._username || '').toArray()
  // If it's a one-on-one chat, use the user's fullname as the description
  const desc =
    meta.teamType === 'adhoc' && otherParticipants.length === 1
      ? stateProps._fullnames.get(otherParticipants[0], {fullname: ''}).fullname
      : meta.description
  return {
    canEditDesc: stateProps.canEditDesc,
    channel:
      meta.teamType === 'big'
        ? `${meta.teamname}#${meta.channelname}`
        : meta.teamType === 'small'
        ? meta.teamname
        : null,
    desc,
    infoPanelOpen: stateProps.infoPanelOpen,
    isTeam: ['small', 'big'].includes(meta.teamType),
    muted: meta.isMuted,
    onNewChat: dispatchProps.onNewChat,
    onOpenFolder: () => dispatchProps._onOpenFolder(stateProps._conversationIDKey),
    onToggleInfoPanel: dispatchProps.onToggleInfoPanel,
    onToggleThreadSearch: () => dispatchProps.onToggleThreadSearch(stateProps._conversationIDKey),
    participants: meta.teamType === 'adhoc' ? meta.participants.toArray() : null,
    showActions: Constants.isValidConversationIDKey(stateProps._conversationIDKey),
    unMuteConversation: () => dispatchProps.onUnMuteConversation(stateProps._conversationIDKey),
  }
}

const Connected = Container.connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Header)

export default Connected
