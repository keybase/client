import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Constants from '../constants/chat2'
import * as TeamConstants from '../constants/teams'
import * as Chat2Gen from '../actions/chat2-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import * as Container from '../util/container'
import ChatInboxHeader from './inbox/row/chat-inbox-header/container'

type OwnProps = {}

type Props = {
  canEditDesc: boolean
  channel: string | null
  desc: string
  infoPanelOpen: boolean
  isTeam: boolean
  muted: boolean
  onOpenFolder: () => void
  onNewChat: () => void
  onToggleInfoPanel: () => void
  onToggleThreadSearch: () => void
  participants: Array<string> | null
  showActions: boolean
  unMuteConversation: () => void
}

const descStyle = {fontSize: 13, lineHeight: '17px' as any, wordBreak: 'break-all'} as const
const descStyleOverride = {
  del: descStyle,
  em: descStyle,
  fence: descStyle,
  inlineCode: descStyle,
  kbfsPath: descStyle,
  link: descStyle,
  mailto: descStyle,
  paragraph: descStyle,
  preview: descStyle,
  strong: descStyle,
}

const Header = (p: Props) => {
  let description = !!p.desc && (
    <Kb.Markdown
      smallStandaloneEmoji={true}
      style={styles.desc}
      styleOverride={descStyleOverride}
      lineClamp={1}
      selectable={true}
    >
      {p.desc}
    </Kb.Markdown>
  )
  if (p.isTeam && !p.desc && p.canEditDesc) {
    description = (
      <Kb.Text selectable={true} type="BodySmall" lineClamp={1}>
        Set a description using the <Kb.Text type="BodySmallBold">/headline</Kb.Text> command.
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
        <Kb.Box2 direction="vertical" style={styles.headerTitle}>
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
          <Kb.Box2
            direction="horizontal"
            gap="small"
            alignItems="flex-end"
            alignSelf="flex-end"
            style={styles.actionIcons}
          >
            <Kb.WithTooltip text="Search in this chat">
              <Kb.Icon style={styles.clickable} type="iconfont-search" onClick={p.onToggleThreadSearch} />
            </Kb.WithTooltip>
            <Kb.WithTooltip text="Open folder">
              <Kb.Icon style={styles.clickable} type="iconfont-folder-private" onClick={p.onOpenFolder} />
            </Kb.WithTooltip>
            <Kb.WithTooltip text="Chat info & settings">
              <Kb.Icon
                style={styles.clickable}
                type={'iconfont-info'}
                onClick={p.onToggleInfoPanel}
                color={p.infoPanelOpen ? Styles.globalColors.blue : undefined}
              />
            </Kb.WithTooltip>
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  actionIcons: {
    paddingBottom: Styles.globalMargins.tiny,
  },
  clickable: Styles.platformStyles({isElectron: Styles.desktopStyles.windowDraggingClickable}),
  container: {
    flexGrow: 1,
    height: 40 - 1,
  },
  desc: {
    ...Styles.platformStyles({isElectron: Styles.desktopStyles.windowDraggingClickable}),
    color: Styles.globalColors.black_50,
  },
  headerTitle: Styles.platformStyles({
    common: {flexGrow: 1, paddingBottom: Styles.globalMargins.xtiny},
    isElectron: Styles.desktopStyles.windowDraggingClickable,
  }),
  left: {minWidth: 260},
  right: {
    flexGrow: 1,
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
    infoPanelOpen: Constants.isInfoPanelOpen(),
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
      : meta.descriptionDecorated
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

const Connected = Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(Header)

export default Connected
