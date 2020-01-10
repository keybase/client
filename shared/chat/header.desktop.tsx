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
import ChatInboxHeader from './inbox/row/chat-inbox-header/container'

type OwnProps = {}

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

const descStyle = {fontSize: 13, lineHeight: '16px', wordBreak: 'break-all'} as const // approximates BodySmall since markdown does not support text type
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
} as any

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
      <Kb.WithTooltip position="bottom left" tooltip="Set the description using the /headline command.">
        {description}
      </Kb.WithTooltip>
    )
  }
  // length ===1 means just you so show yourself
  const withoutSelf =
    p.participants && p.participants.length > 1
      ? p.participants.filter(part => part !== p.username)
      : p.participants

  // if there is no description (and is not a 1-on-1), don't render the description box
  const renderDescription = description || (p.fullName && withoutSelf && withoutSelf.length === 1)

  // trim() call makes sure that string is not just whitespace
  if (withoutSelf && withoutSelf.length === 1 && p.desc.trim()) {
    description = (
      <Kb.Markdown
        smallStandaloneEmoji={true}
        style={{...styles.desc, flex: 1}}
        styleOverride={descStyleOverride}
        lineClamp={1}
        selectable={true}
      >
        {p.desc}
      </Kb.Markdown>
    )
  }
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="vertical" style={styles.left}>
        <ChatInboxHeader />
      </Kb.Box2>
      <Kb.Box2
        direction="horizontal"
        style={styles.right}
        gap="small"
        alignItems="flex-end"
        alignSelf="flex-end"
      >
        <Kb.Box2
          direction="vertical"
          style={renderDescription ? styles.headerTitle : styles.headerTitleNoDesc}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            {p.channel ? (
              <Kb.Text selectable={true} type="Header" lineClamp={1}>
                {p.channel}
              </Kb.Text>
            ) : p.fullName ? (
              <Kb.Text type="Header" lineClamp={1}>
                {p.fullName}
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
                        usernames={[part]}
                        onUsernameClicked="profile"
                      />
                      {i !== withoutSelf.length - 1 && <Kb.Text type="Header">, </Kb.Text>}
                    </Kb.Text>
                  ))}
                </Kb.Text>
              </Kb.Box2>
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
          {renderDescription && (
            <Kb.Box2 direction="vertical" style={styles.descriptionContainer} fullWidth={true}>
              {p.fullName && withoutSelf && withoutSelf.length === 1 ? (
                <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.descriptionTextContainer}>
                  <Kb.ConnectedUsernames
                    colorFollowing={true}
                    underline={true}
                    inline={true}
                    commaColor={Styles.globalColors.black_50}
                    type="BodySmallSemibold"
                    usernames={[withoutSelf[0]]}
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
        {p.showActions && (
          <Kb.Box2
            direction="horizontal"
            gap="small"
            alignItems="flex-end"
            alignSelf="flex-end"
            style={styles.actionIcons}
          >
            <Kb.WithTooltip tooltip={`Search in this chat (${Platforms.shortcutSymbol}F)`}>
              <Kb.Icon style={styles.clickable} type="iconfont-search" onClick={p.onToggleThreadSearch} />
            </Kb.WithTooltip>
            <Kb.WithTooltip tooltip="Open folder">
              <Kb.Icon style={styles.clickable} type="iconfont-folder-private" onClick={p.onOpenFolder} />
            </Kb.WithTooltip>
            <Kb.WithTooltip tooltip="Chat info & settings">
              <Kb.Icon style={styles.clickable} type="iconfont-info" onClick={p.onToggleInfoPanel} />
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
      }),
      headerTitle: Styles.platformStyles({
        common: {flexGrow: 1, paddingBottom: Styles.globalMargins.xtiny},
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
      headerTitleNoDesc: Styles.platformStyles({
        common: {flexGrow: 1, paddingBottom: Styles.globalMargins.tiny},
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
    } as const)
)

const Connected = Container.connect(
  state => {
    const _conversationIDKey = Constants.getSelectedConversation(state)
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
    onNewChat: () => dispatch(appendNewChatBuilder()),
    onHideInfoPanel: () => dispatch(Chat2Gen.createShowInfoPanel({show: false})),
    onShowInfoPanel: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true})),
    _onToggleThreadSearch: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey})),
    _unMuteConversation: (conversationIDKey: Types.ConversationIDKey) =>
      dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: false})),
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
