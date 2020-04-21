import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Types from '../constants/types/chat2'
import * as Constants from '../constants/chat2'
import * as TeamConstants from '../constants/teams'
import * as Platforms from '../constants/platform'
import * as Chat2Gen from '../actions/chat2-gen'
import {appendNewChatBuilder} from '../actions/typed-routes'
import * as Styles from '../styles'
import * as Container from '../util/container'
import ChatInboxHeader from './inbox/header/container'

type OwnProps = {
  navigation: any
}

type Props = {
  canEditDesc: boolean
  channel: string | null
  desc: string
  isTeam: boolean
  muted: boolean
  onOpenFolder: () => void
  onNewChat: () => void
  onToggleInfoPanel: () => void
  onToggleThreadSearch: () => void
  participants: Array<string> | null
  showActions: boolean
  unMuteConversation: () => void
  username: string
  fullName?: string
}

const Header = (p: Props) => {
  const {desc, canEditDesc, isTeam, participants, fullName, channel, showActions, muted, username} = p
  const {onToggleInfoPanel, onToggleThreadSearch, unMuteConversation, onOpenFolder} = p
  const descStyleOverride = React.useMemo(
    () => ({
      del: styles.markdownOverride,
      em: styles.markdownOverride,
      fence: styles.markdownOverride,
      inlineCode: styles.markdownOverride,
      kbfsPath: styles.markdownOverride,
      link: styles.markdownOverride,
      mailto: styles.markdownOverride,
      paragraph: styles.markdownOverride,
      preview: styles.markdownOverride,
      strong: styles.markdownOverride,
    }),
    []
  )

  let description = !!desc && (
    <Kb.Markdown
      smallStandaloneEmoji={true}
      style={styles.desc}
      styleOverride={descStyleOverride}
      lineClamp={1}
      selectable={true}
    >
      {desc}
    </Kb.Markdown>
  )
  if (isTeam && !desc && canEditDesc) {
    description = (
      <Kb.Text selectable={true} type="BodySmall" lineClamp={1}>
        Set a description using the <Kb.Text type="BodySmallBold">/headline</Kb.Text> command.
      </Kb.Text>
    )
  }
  if (isTeam && desc && canEditDesc) {
    description = (
      <Kb.WithTooltip position="bottom left" tooltip="Set the description using the /headline command.">
        {description}
      </Kb.WithTooltip>
    )
  }
  // length ===1 means just you so show yourself
  const withoutSelf =
    participants && participants.length > 1 ? participants.filter(part => part !== username) : participants

  // if there is no description (and is not a 1-on-1), don't render the description box
  const renderDescription = description || (fullName && withoutSelf && withoutSelf.length === 1)

  const infoPanelOpen = Container.useSelector(state => state.chat2.infoPanelShowing)

  // trim() call makes sure that string is not just whitespace
  if (withoutSelf && withoutSelf.length === 1 && desc.trim()) {
    description = (
      <Kb.Markdown
        smallStandaloneEmoji={true}
        style={{...styles.desc, flex: 1}}
        styleOverride={descStyleOverride}
        lineClamp={1}
        selectable={true}
      >
        {desc}
      </Kb.Markdown>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="vertical" style={styles.left}>
        <ChatInboxHeader context="chat-header" />
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        style={styles.right}
        fullHeight={!renderDescription}
        gap="small"
        alignItems="flex-end"
        alignSelf="flex-end"
      >
        <Kb.Box2 direction="vertical" style={styles.headerTitle}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            {channel ? (
              <Kb.Text selectable={true} type="Header" lineClamp={1}>
                {channel}
              </Kb.Text>
            ) : fullName ? (
              <Kb.Text type="Header" lineClamp={1}>
                {fullName}
              </Kb.Text>
            ) : withoutSelf ? (
              <Kb.Box2 direction="horizontal" style={Styles.globalStyles.flexOne}>
                <Kb.Text type="Header" lineClamp={1}>
                  {withoutSelf.map((part, i) => (
                    <Kb.Text type="Header" key={part}>
                      <Kb.ConnectedUsernames
                        colorFollowing={true}
                        underline={true}
                        inline={true}
                        commaColor={Styles.globalColors.black_50}
                        type="Header"
                        usernames={part}
                        onUsernameClicked="profile"
                      />
                      {i !== withoutSelf.length - 1 && <Kb.Text type="Header">, </Kb.Text>}
                    </Kb.Text>
                  ))}
                </Kb.Text>
              </Kb.Box2>
            ) : null}
            {muted && (
              <Kb.Icon
                type="iconfont-shh"
                style={styles.shhIconStyle}
                color={Styles.globalColors.black_20}
                fontSize={20}
                onClick={unMuteConversation}
              />
            )}
          </Kb.Box2>
          {renderDescription && (
            <Kb.Box2 direction="vertical" style={styles.descriptionContainer} fullWidth={true}>
              {fullName && withoutSelf && withoutSelf.length === 1 ? (
                <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.descriptionTextContainer}>
                  <Kb.ConnectedUsernames
                    colorFollowing={true}
                    underline={true}
                    inline={true}
                    commaColor={Styles.globalColors.black_50}
                    type="BodySmallBold"
                    usernames={withoutSelf[0]}
                    onUsernameClicked="profile"
                  />
                  {description && (
                    <>
                      <Kb.Text type="BodySmall" style={styles.desc}>
                        &nbsp;•&nbsp;
                      </Kb.Text>
                      {description}
                    </>
                  )}
                </Kb.Box2>
              ) : (
                description
              )}
            </Kb.Box2>
          )}
        </Kb.Box2>
        {showActions && (
          <Kb.Box2
            direction="horizontal"
            gap="small"
            alignItems="flex-end"
            alignSelf="flex-end"
            style={styles.actionIcons}
          >
            <Kb.WithTooltip tooltip={`Search in this chat (${Platforms.shortcutSymbol}F)`}>
              <Kb.Icon style={styles.clickable} type="iconfont-search" onClick={onToggleThreadSearch} />
            </Kb.WithTooltip>
            <Kb.WithTooltip tooltip="Open folder">
              <Kb.Icon style={styles.clickable} type="iconfont-folder-private" onClick={onOpenFolder} />
            </Kb.WithTooltip>
            <Kb.WithTooltip tooltip="Chat info & settings">
              <Kb.Icon
                color={infoPanelOpen ? Styles.globalColors.blue : undefined}
                style={styles.clickable}
                type="iconfont-info"
                onClick={onToggleInfoPanel}
              />
            </Kb.WithTooltip>
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
      descriptionContainer: {
        height: 17,
        overflow: 'hidden',
      },
      descriptionTextContainer: Styles.platformStyles({
        isElectron: {
          alignItems: 'baseline',
        },
        isTablet: {
          alignItems: 'baseline',
        },
      }),
      headerTitle: Styles.platformStyles({
        common: {
          flexGrow: 1,
          paddingBottom: Styles.globalMargins.xtiny,
        },
        isElectron: Styles.desktopStyles.windowDraggingClickable,
        isTablet: {
          flex: 1,
        },
      }),
      left: Styles.platformStyles({
        common: {width: Styles.globalStyles.mediumSubNavWidth},
        isTablet: {
          paddingLeft: Styles.globalMargins.small,
        },
      }),
      markdownOverride: Styles.platformStyles({
        common: {
          fontSize: 13,
          lineHeight: 17,
        },
        isElectron: {
          fontSize: 13,
          lineHeight: 17,
          wordBreak: 'break-all',
        },
        isMobile: {
          color: Styles.globalColors.black_50,
          fontSize: 15,
          lineHeight: 19,
        },
      }),
      right: Styles.platformStyles({
        common: {
          flex: 1,
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.tiny,
        },
      }),
      shhIconStyle: {
        marginLeft: Styles.globalMargins.xtiny,
      },
    } as const)
)

const Connected = Container.connect(
  (state, ownProps: OwnProps) => {
    // temp until nav 5 when this all goes away
    const _conversationIDKey =
      (Container.isTablet
        ? ownProps.navigation.state.params?.conversationIDKey
        : ownProps.navigation.state.routes[0]?.params?.conversationIDKey) ?? Constants.noConversationIDKey
    const userInfo = state.users.infoMap
    const _meta = Constants.getMeta(state, _conversationIDKey)
    const participantInfo = Constants.getParticipantInfo(state, _conversationIDKey)
    const {infoPanelShowing} = state.chat2
    const {username} = state.config

    const otherParticipants = Constants.getRowParticipants(participantInfo, username)
    const first: string =
      _meta.teamType === 'adhoc' && otherParticipants.length === 1 ? otherParticipants[0] : ''
    const otherInfo = userInfo.get(first)
    // If it's a one-on-one chat, use the user's fullname as the description
    const desc =
      (otherInfo && otherInfo.bio && otherInfo.bio.replace(/(\r\n|\n|\r)/gm, ' ')) ||
      _meta.descriptionDecorated
    const fullName = otherInfo && otherInfo.fullname

    return {
      _conversationIDKey,
      _meta,
      _participantInfo: participantInfo,
      canEditDesc: TeamConstants.getCanPerform(state, _meta.teamname).editChannelDescription,
      desc,
      fullName,
      infoPanelShowing,
      username: state.config.username,
    }
  },
  dispatch => ({
    _onOpenFolder: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createOpenFolder({conversationIDKey})),
    _onToggleThreadSearch: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    _unMuteConversation: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
    onHideInfoPanel: () => dispatch(Chat2Gen.createShowInfoPanel({show: false})),
    onNewChat: () => dispatch(appendNewChatBuilder()),
    onShowInfoPanel: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {infoPanelShowing, username, fullName, desc} = stateProps
    const {_meta, _conversationIDKey, _participantInfo} = stateProps
    const {teamType, channelname, teamname, isMuted} = _meta
    const {_onOpenFolder, _onToggleThreadSearch, _unMuteConversation} = dispatchProps
    const {onHideInfoPanel, onNewChat, onShowInfoPanel} = dispatchProps

    return {
      canEditDesc: stateProps.canEditDesc,
      channel: teamType === 'big' ? `${teamname}#${channelname}` : teamType === 'small' ? teamname : null,
      desc,
      fullName,
      isTeam: ['small', 'big'].includes(teamType),
      muted: isMuted,
      onNewChat,
      onOpenFolder: () => _onOpenFolder(_conversationIDKey),
      onToggleInfoPanel: infoPanelShowing ? onHideInfoPanel : () => onShowInfoPanel(_conversationIDKey),
      onToggleThreadSearch: () => _onToggleThreadSearch(_conversationIDKey),
      participants: teamType === 'adhoc' ? _participantInfo.name : null,
      showActions: Constants.isValidConversationIDKey(_conversationIDKey),
      unMuteConversation: () => _unMuteConversation(_conversationIDKey),
      username,
    }
  }
)(Header)

export default Connected
